import axios from 'axios';
import axiosCookiejarSupport from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { Guid } from './guid';
import logger from './logger';
import { timeoutFor } from './timeoutHelper';
import { WebSocketHandler } from './webSocketHandler';

export class ChunkCache {
    public onPixelUpdate?: (x: number, y: number, color: number) => void;

    private cachedChunks: { [id: number]: Buffer; } = {};
    private ws: WebSocketHandler;

    private cookieJar = new CookieJar();
    private fingerprint: string;

    public constructor() {
        axiosCookiejarSupport(axios);

        this.fingerprint = Guid.newGuid();

        this.ws = new WebSocketHandler(this.fingerprint);
        this.ws.onPixelUpdate = this.onUpdatePixelInChunk.bind(this);
        this.ws.connect();
    }

    public async getCoordinateColor(xGlobal: number, yGlobal: number): Promise<number> {
        const x = xGlobal + 32768;
        const y = yGlobal + 32768;

        const chunkX = Math.floor(x / 256);
        const chunkY = Math.floor(y / 256);
        const cachedChunkId = chunkX + chunkY * 256;
        if (!this.cachedChunks[cachedChunkId]) {
            this.cachedChunks[cachedChunkId] = await this.retryFetchChunkData(chunkX, chunkY);
            const chunkId = (chunkX * 256 + chunkY);
            this.ws.watchChunk(chunkId);
        }

        const xPixelInChunk = x % 256;
        const yPixelInChunk = y % 256;

        return this.cachedChunks[cachedChunkId].readInt8(xPixelInChunk + (yPixelInChunk * 256));
    }

    public async retryPostPixel(x: number,
                                y: number,
                                color: number,
        ): Promise<PixelPlanetPixelPostResponse> {
        return this.postPixel(x, y, color).then(async (res) => {
            if (!res.success) {
                await timeoutFor((res.waitSeconds - 50) * 1000);
                return this.retryPostPixel(x, y, color);
            }
            return res;
        }).catch(async (reason) => {
            logger.logWarn(reason);
            await timeoutFor(2000);
            return this.retryPostPixel(x, y, color);
        });
    }

    public async postPixel(x: number,
                           y: number,
                           color: number,
        ): Promise<PixelPlanetPixelPostResponse> {
        const bodyData = {
            color,
            x,
            y,
            a: x + y - 8,
            fingerprint: this.fingerprint,
            token: null,
        };

        const resp = await axios({
            data: JSON.stringify(bodyData),
            headers: {
                'Content-Type': 'application/json',
                Origin: 'https://pixelpixel.fun',
                Referer: 'https://pixelpixel.fun/',
// tslint:disable-next-line: max-line-length
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0',
            },
            jar: this.cookieJar,
            method: 'post',
            url: 'https://pixelplanet.fun/api/pixel',
            withCredentials: true,

        }).catch((error) => {
            switch (error.response.status) {
            case 403:
                    // Forbidden: Either admin has blocked your Ip or you ran into protected pixels.
                    // At this point it's better to just stop.
// tslint:disable-next-line: max-line-length
                logger.logError('You just ran into Admin. He has prevented you from placing pixel. STOPPING NOW!');
                process.exit(1);
                throw new Error('Stopped by admin');
            default:
                throw new Error(`Pixel posting responded with ${error.message}`);
            }
        });

        switch (resp.status) {
        case 200:
            await this.setPixelColor(x, y, color);
            return resp.data as PixelPlanetPixelPostResponse;
        default:
            throw new Error(`Pixel posting responded with ${resp.statusText}`);
        }
    }

    private async setPixelColor(xGlobal: number, yGlobal: number, c: number) {
        const x = xGlobal + 32768;
        const y = yGlobal + 32768;

        const chunkX = Math.floor(x / 256);
        const chunkY = Math.floor(y / 256);
        const cachedChunkId = chunkX + chunkY * 256;

        if (!this.cachedChunks[cachedChunkId]) {
            this.cachedChunks[cachedChunkId] = await this.retryFetchChunkData(chunkX, chunkY);
            this.ws.watchChunk(cachedChunkId);
            return;
        }

        const xPixelInChunk = x % 256;
        const yPixelInChunk = y % 256;

        this.cachedChunks[cachedChunkId].writeInt8(c, (xPixelInChunk + (yPixelInChunk * 256)));
    }

    private async onUpdatePixelInChunk(chunkX: number,
                                       chunkY: number,
                                       pixelIdInChunk: number,
                                       color: number,
        ): Promise<void> {
        const cachedChunkId = chunkX + chunkY * 256;
        if (!this.cachedChunks[cachedChunkId]) {
            return;
        }
// tslint:disable-next-line: max-line-length
        logger.log(`Pixel updated received: ${chunkX * 256 + pixelIdInChunk % 256 - 32768}:${chunkY * 256 + Math.floor(pixelIdInChunk / 256) - 32768}, color: ${color}`);
        this.cachedChunks[cachedChunkId].writeInt8(color, pixelIdInChunk);
        if (this.onPixelUpdate) {
            this.onPixelUpdate(chunkX * 256 + pixelIdInChunk % 256 - 32768,
                               chunkY * 256 + Math.floor(pixelIdInChunk / 256) - 32768,
                               color);
        }
    }

    private async retryFetchChunkData(x: number, y: number): Promise<Buffer> {
        return this.fetchChunkData(x, y).catch(async (reason) => {
            logger.logWarn(reason);
            await timeoutFor(2000);
            return this.retryFetchChunkData(x, y);
        });
    }

    private async fetchChunkData(x: number, y: number): Promise<Buffer> {
        const resp = await axios({
            headers: {
                Origin: 'https://pixelpixel.fun',
                Referer: 'https://pixelpixel.fun/',
// tslint:disable-next-line: max-line-length
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0',
            },
            jar: this.cookieJar,
            method: 'get',
            url: `https://pixelplanet.fun/chunks/${x}/${y}.bin`,
            withCredentials: true,
        }).catch((error) => {
            switch (error.response.status) {
            case 403:
                    // Forbidden: Either admin has blocked your Ip or you ran into protected pixels.
                    // At this point it's better to just stop.
// tslint:disable-next-line: max-line-length
                logger.logError('You just ran into Admin. He has prevented you from placing pixel. STOPPING NOW!');
                process.exit(1);
                throw new Error('Stopped by admin');
            default:
                throw new Error(`Chunk gathering responded with ${error.response.statusText}`);
            }
        });

        switch (resp.status) {
        case 200:
            if (resp.data === '') {
                    // this means chunk is completely empty.
                return Buffer.alloc(256 * 256, 0);
            }
            const buffer = Buffer.from(resp.data);
            return buffer;
        default:
            throw new Error(`Chunk gathering responded with ${resp.statusText}`);
        }
    }
}
