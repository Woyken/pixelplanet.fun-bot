import { PNG } from "pngjs";
import { ChunkCache } from "./chunkCache";
import colorConverter from "./colorConverter";
import { ImageProcessor } from "./imageProcessor";
import { timeoutFor } from "./timeoutHelper";

export class PixelWorker {

    public static async create(image: PNG, startPoint: {x: number, y: number}, doNotOverrideColorList: number[], fingerprint: string, customEdgesMap: string) {
        const imgProcessor = await ImageProcessor.create(image, customEdgesMap);
        return new PixelWorker(imgProcessor, image, startPoint, doNotOverrideColorList, fingerprint);
    }

    public currentWorkingList: Array<{x: number, y: number}> = [];

    private image: PNG;
    private startPoint: {x: number, y: number};
    private imgProcessor: ImageProcessor;
    private chunkCache: ChunkCache;
    private doNotOverrideColorList: number[];
    private fingerprint: string;
    private working = false;

    constructor(imgProcessor: ImageProcessor, image: PNG, startPoint: {x: number, y: number}, doNotOverrideColorList: number[], fingerprint: string) {
        this.chunkCache = new ChunkCache(fingerprint);
        this.imgProcessor = imgProcessor;
        this.image = image;
        this.startPoint = startPoint;
        this.doNotOverrideColorList = doNotOverrideColorList;
        this.fingerprint = fingerprint;

        this.chunkCache.onPixelUpdate = this.onPixelUpdate.bind(this);

        // Initialize the working list.

        const picMiddleX = Math.floor( this.image.width / 2);
        const picMiddleY = Math.floor( this.image.height / 2);

        for (let i = 255; i >= 0; i--) {
            this.imgProcessor.getIncrementalEdges(i, i).sort((a, b) => {
                // Sort by distance from middle. Start from furthest points
                const distA = Math.sqrt((a.x - picMiddleX) * (a.x - picMiddleX) + (a.y - picMiddleY) * (a.y - picMiddleY));
                const distB = Math.sqrt((b.x - picMiddleX) * (b.x - picMiddleX) + (b.y - picMiddleY) * (b.y - picMiddleY));
                return distA - distB;
            }).forEach((value) => {
                // Convert to global coordinates.
                this.currentWorkingList.push({x: this.startPoint.x + value.x, y: this.startPoint.y + value.y});
            });
        }
    }

    public async heartBeat() {
        if (!this.working) {
            await this.doWork();
        }
    }

    private onPixelUpdate(x: number, y: number, color: number): void {
        const pixelColorInImage = this.getPixelColorFromImage(x, y);
        if (pixelColorInImage.a === 0) {
            // don't draw if alpha is 0
            return;
        }
        const targetColor = colorConverter.convertActualColor(pixelColorInImage.r, pixelColorInImage.g, pixelColorInImage.b);
        const pixelNeedsPlacing = this.doesPixelNeedReplacing(x, y, targetColor);
        if (pixelNeedsPlacing) {
            this.currentWorkingList.push({x, y});
            this.heartBeat();
        }
    }

    private async doesPixelNeedReplacing(x: number, y: number, color: number): Promise<boolean> {
        const currentColor = await this.chunkCache.getCoordinateColor(x, y);
        // Pixel current color doesn't match and it is not found in the do not override list.
        return !colorConverter.areColorsEqual(color, currentColor) &&
            this.doNotOverrideColorList.findIndex((c) => c === currentColor) < 0;
    }

    private getPixelColorFromImage(x: number, y: number): {r: number, g: number, b: number, a: number} {
        const xInImage = x - this.startPoint.x;
        const yInImage = y - this.startPoint.y;

        // tslint:disable-next-line: no-bitwise
        const idx = (this.image.width * yInImage + xInImage) << 2;

        const r = this.image.data[idx + 0];
        const g = this.image.data[idx + 1];
        const b = this.image.data[idx + 2];
        const a = this.image.data[idx + 3];

        return {r, g, b, a};
    }

    private async doWork() {
        this.working = true;

        while (this.currentWorkingList.length > 0) {
            const currentTargetCoords = this.currentWorkingList.pop();
            const pixelColorInImage = this.getPixelColorFromImage(currentTargetCoords!.x, currentTargetCoords!.y);
            if (pixelColorInImage.a === 0) {
                // don't draw if alpha is 0
                continue;
            }

            const targetColor = colorConverter.convertActualColor(pixelColorInImage.r, pixelColorInImage.g, pixelColorInImage.b);
            const pixelNeedsPlacing = await this.doesPixelNeedReplacing(currentTargetCoords!.x, currentTargetCoords!.y, targetColor);

            if (pixelNeedsPlacing) {
                const postPixelResult = await this.chunkCache.retryPostPixel(currentTargetCoords!.x, currentTargetCoords!.y, targetColor, this.fingerprint);
                // tslint:disable-next-line: no-console
                console.log("Just placed " + targetColor + " at " + currentTargetCoords!.x + ":" + currentTargetCoords!.y);

                if (postPixelResult.waitSeconds > 50) {
                    const waitingFor = Math.floor(postPixelResult.waitSeconds - Math.random() * 40);

                    // tslint:disable-next-line: no-console
                    console.log("Waiting for: " + waitingFor + " seconds");
                    await timeoutFor((waitingFor) * 1000);
                }
            }
        }
        this.working = false;
    }
}
