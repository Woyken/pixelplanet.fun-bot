import axios from "axios";
import axiosCookieJarSupport from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { timeoutFor } from "./timeoutHelper";
import { WebSocketHandler } from "./webSocketHandler";

export class ChunkCache {
    private cachedChunks: { [id: number]: Buffer; } = {};
    private ws: WebSocketHandler;

    private cookieJar = new CookieJar();

    public constructor(fingerprint: string) {
        axiosCookieJarSupport(axios);

        this.ws = new WebSocketHandler(fingerprint);
        this.ws.onPixelUpdate = this.onUpdatePixelInChunk.bind(this);
        this.ws.connect();
    }

    public async getCoordinateColor(x: number, y: number): Promise<number> {
        x += 32768;
        y += 32768;

        const chunkX = Math.floor(x / 256);
        const chunkY = Math.floor(y / 256);
        const cachedChunkId = chunkX + chunkY * 256;
        if (!this.cachedChunks[cachedChunkId]) {
            this.cachedChunks[cachedChunkId] = await this.retryfetchChunkData(chunkX, chunkY);
            this.ws.watchChunk(cachedChunkId);
        }

        const xPixelInChunk = x % 256;
        const yPixelInChunk = y % 256;

        return this.cachedChunks[cachedChunkId].readInt8(xPixelInChunk + (yPixelInChunk * 256));
    }

    public async retryPostPixel(x: number, y: number, color: number, fingerprint: string): Promise<PixelPlanetPixelPostResponse> {
        return this.postPixel(x, y, color, fingerprint).then(async (res) => {
            if (!res.success) {
                await timeoutFor((res.waitSeconds - 50) * 1000);
                return this.retryPostPixel(x, y, color, fingerprint);
            }
            return res;
        }).catch(async (reason) => {
            // tslint:disable-next-line: no-console
            console.log(reason);
            await timeoutFor(2000);
            return this.retryPostPixel(x, y, color, fingerprint);
        });
    }

    public async postPixel(x: number, y: number, color: number, fingerprint: string): Promise<PixelPlanetPixelPostResponse> {
        const bodyData = {
            a: x + y - 8,
            color,
            fingerprint,
            token: null,
            x,
            y,
        };

        const resp = await axios({
            data: JSON.stringify(bodyData),
            headers: {
                "Content-Type": "application/json",
                "Origin": "https://pixelpixel.fun",
                "Referer": "https://pixelpixel.fun/",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0",
            },
            jar: this.cookieJar,
            method: "post",
            url: "https://pixelplanet.fun/api/pixel",
            withCredentials: true,

        });

        if (resp.status !== 200) {
            // tslint:disable-next-line: no-console
            console.log("pixel posting responded with " + resp.statusText);
            throw new Error("response did not succeed, " + resp.statusText);
        } else {
            await this.setPixelColor(x, y, color);
            return resp.data as PixelPlanetPixelPostResponse;
        }
    }

    private async setPixelColor(x: number, y: number, c: number) {
        x += 32768;
        y += 32768;

        const chunkX = Math.floor(x / 256);
        const chunkY = Math.floor(y / 256);
        const cachedChunkId = chunkX + chunkY * 256;

        if (!this.cachedChunks[cachedChunkId]) {
            this.cachedChunks[cachedChunkId] = await this.retryfetchChunkData(chunkX, chunkY);
            this.ws.watchChunk(cachedChunkId);
            return;
        }

        const xPixelInChunk = x % 256;
        const yPixelInChunk = y % 256;

        this.cachedChunks[cachedChunkId].writeInt8(c, (xPixelInChunk + (yPixelInChunk * 256)));
    }

    private async onUpdatePixelInChunk(chunkX: number, chunkY: number, pixelIdInChunk: number, color: number): Promise<void> {
        const cachedChunkId = chunkX + chunkY * 256;
        if (!this.cachedChunks[cachedChunkId]) {
            return;
        }
        this.cachedChunks[cachedChunkId].writeInt8(color, pixelIdInChunk);
    }

    private async retryfetchChunkData(x: number, y: number): Promise<Buffer> {
        return this.fetchChunkData(x, y).catch(async (reason) => {
            // tslint:disable-next-line: no-console
            console.log(reason);
            await timeoutFor(2000);
            return this.retryfetchChunkData(x, y);
        });
    }

    private async fetchChunkData(x: number, y: number): Promise<Buffer> {
        const resp = await axios({
            headers: {
                "Origin": "https://pixelpixel.fun",
                "Referer": "https://pixelpixel.fun/",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0",
            },
            jar: this.cookieJar,
            method: "get",
            url: `https://pixelplanet.fun/chunks/${x}/${y}.bin`,
            withCredentials: true,
        });

        switch (resp.status) {
            case 200:
                if (resp.data === "") {
                    // this means chunk is completely empty.
                    return Buffer.alloc(256 * 256, 0);
                }
                const buffer = Buffer.from(resp.data);
                return buffer;

            case 403:
                // Forbidden: Either admin has blocked your Ip or you ran into protected pixels. At this point it's better to just stop.
                // tslint:disable-next-line: no-console
                console.error("You just into Admin. He has prevented you from placing pixel. STOPPING NOW!");
                process.exit(0);
                throw new Error("Stopped by admin");
                break;
            default:
                // tslint:disable-next-line: no-console
                console.log("Chunk gathering responded with " + resp.statusText);
                throw new Error("response did not succeed");
        }
    }
}
