import { PNG } from 'pngjs';
import { ChunkCache } from './chunkCache';
import colorConverter from './colorConverter';
import { ImageProcessor } from './imageProcessor';
import logger from './logger';
import { timeoutFor } from './timeoutHelper';
import { SpecialExclusionHandler } from './specialExclusionHandler';

async function yieldingLoop(
    count: number,
    chunkSize: number,
    callback: (i: number) => Promise<void>,
    onYield: () => Promise<void>,
    finished: () => void) {

    return new Promise<void>((resolve, reject) => {
        let i = 0;
        (async function chunk() {
            const end = Math.min(i + chunkSize, count);
            for (; i < end; ++i) {
                await callback(i);
            }
            if (i < count) {
                await onYield();
                setTimeout(chunk, 0);
            } else {
                finished();
                resolve();
            }
        })().catch();
    });
}

enum WorkerStatus {
    Initializing,
    Working,
    Done,
}

export class PixelWorker {

    public static async create(image: PNG,
                               startPoint: { x: number, y: number },
                               doNotOverrideColorList: number[],
                               customEdgesMap: string) {
        const imgProcessor = await ImageProcessor.create(image, customEdgesMap);
        const specialExclusion = await SpecialExclusionHandler.create();
        return new PixelWorker(imgProcessor,
                               specialExclusion,
                               image,
                               startPoint,
                               doNotOverrideColorList);
    }

    public currentWorkingList: { x: number, y: number }[] = [];

    private statusState: WorkerStatus = WorkerStatus.Initializing;
    private image: PNG;
    private startPoint: { x: number, y: number };
    private imgProcessor: ImageProcessor;
    private chunkCache: ChunkCache;
    private specialExclusions: SpecialExclusionHandler;
    private doNotOverrideColorList: number[];
    private working = false;
    private onStatusChanged?: () => void;

    constructor(imgProcessor: ImageProcessor,
                specialExclusion: SpecialExclusionHandler,
                image: PNG,
                startPoint: { x: number, y: number },
                doNotOverrideColorList: number[]) {
        this.chunkCache = new ChunkCache();
        this.specialExclusions = specialExclusion;
        this.imgProcessor = imgProcessor;
        this.image = image;
        this.startPoint = startPoint;
        this.doNotOverrideColorList = doNotOverrideColorList;

        this.chunkCache.onPixelUpdate = this.onPixelUpdate.bind(this);
        this.initializeData().catch(() => {
            logger.logError('Initialization has failed!');
        });
    }

    public async heartBeat() {
        if (!this.working) {
            await this.doWork();
        }
    }

    public async waitForComplete() {
        return new Promise<void>((resolve, reject) => {
            this.onStatusChanged = () => {
                if (this.status === WorkerStatus.Done) {
                    resolve();
                    this.onStatusChanged = undefined;
                    return;
                }
            };
        });
    }

    private set status(value: WorkerStatus) {
        this.statusState = value;
        if (this.onStatusChanged) {
            this.onStatusChanged();
        }
    }

    private get status() {
        return this.statusState;
    }

    private async initializeData() {
        logger.log('Initializing...');

        this.status = WorkerStatus.Initializing;
        // Initialize the working list.

        const picMiddleX = Math.floor(this.image.width / 2);
        const picMiddleY = Math.floor(this.image.height / 2);

        // iterate from 0x00 to 0xff of white color through the "edges map"
        for (let i = 0; i <= 255; i++) {
            const sortedList = this.imgProcessor
                .getIncrementalEdges(i, i)
                .sort((a, b) => {
                    // If pixel is on grid - take priority.
                    const gridSize = 10;
                    let aIsOnGrid: boolean = false;
                    let bIsOnGrid: boolean = false;
                    if ((a.x + a.y) % gridSize === 0 || Math.abs(a.x - a.y) % gridSize === 0) {
                        aIsOnGrid = true;
                    }

                    if ((b.x + b.y) % gridSize === 0 || Math.abs(b.x - b.y) % gridSize === 0) {
                        bIsOnGrid = true;
                    }

                    // on grid pixels will have priority over all else.
                    if (aIsOnGrid && !bIsOnGrid) {
                        return 1;
                    }
                    if (!aIsOnGrid && bIsOnGrid) {
                        return -1;
                    }

                    // Sort by distance from middle. Start from furthest points
                    const distA = Math.sqrt(
                        (a.x - picMiddleX) * (a.x - picMiddleX) +
                        (a.y - picMiddleY) * (a.y - picMiddleY),
                    );
                    const distB = Math.sqrt(
                        (b.x - picMiddleX) * (b.x - picMiddleX) +
                        (b.y - picMiddleY) * (b.y - picMiddleY),
                    );
                    return distA - distB;
                });

            // non blocking loop, will allow pixel placing to start sooner.
            await yieldingLoop(sortedList.length, 20, async (j) => {
                const value = sortedList[j];
                // Convert to global coordinates.
                const pixelCoords = {
                    x: this.startPoint.x + value.x,
                    y: this.startPoint.y + value.y,
                };
                if (await this.shouldPlaceGlobalPixel(pixelCoords.x, pixelCoords.y)) {
                    this.currentWorkingList.push(pixelCoords);
                }
            },                 async () => {
                this.heartBeat().catch();
            },                 () => {
                // current loop is complete
            });
        }
        this.status = WorkerStatus.Working;

        this.heartBeat().catch();

        logger.log('Initialization complete');
    }

    private async onPixelUpdate(x: number, y: number, color: number): Promise<void> {
        if (await this.shouldPlaceGlobalPixel(x, y)) {
            // Random delay, up to 2 seconds, before adding to list.
            // Adds a chance that multiple bots won't paint same pixel.
            setTimeout(() => {
                this.currentWorkingList.unshift({ x, y });
                this.heartBeat().catch();
            },         Math.random() * 2 * 1000);
        }
    }

    private async shouldPlaceGlobalPixel(x: number, y: number): Promise<boolean> {
        if (x - this.startPoint.x >= this.image.width ||
            y - this.startPoint.y >= this.image.height ||
            x - this.startPoint.x < 0 ||
            y - this.startPoint.y < 0) {
            // The pixel is outside of our image, don't care.
            return false;
        }
        const pixelColorInImage = this.getPixelColorFromImage(x, y);
        if (pixelColorInImage.a === 0) {
            // don't draw if alpha is 0
            return false;
        }
        const targetColor = colorConverter.convertActualColor(pixelColorInImage.r,
                                                              pixelColorInImage.g,
                                                              pixelColorInImage.b);
        const pixelNeedsPlacing = this.doesPixelNeedReplacing(x, y, targetColor);
        return pixelNeedsPlacing;
    }

    private async doesPixelNeedReplacing(x: number, y: number, color: number): Promise<boolean> {
        if (this.specialExclusions.isPixelExcluded(x, y)) {
            return false;
        }
        const currentColor = await this.chunkCache.getCoordinateColor(x, y);
        // Pixel current color doesn't match and it is not found in the do not override list.
        return !colorConverter.areColorsEqual(color, currentColor) &&
            this.doNotOverrideColorList.findIndex((c) => {
                return c === currentColor;
            }) < 0;
    }

    private getPixelColorFromImage(x: number,
                                   y: number,
                                   ): { r: number, g: number, b: number, a: number } {
        const xInImage = x - this.startPoint.x;
        const yInImage = y - this.startPoint.y;

        // tslint:disable-next-line: no-bitwise
        const idx = (this.image.width * yInImage + xInImage) << 2;

        const r = this.image.data[idx + 0];
        const g = this.image.data[idx + 1];
        const b = this.image.data[idx + 2];
        const a = this.image.data[idx + 3];

        return { r, g, b, a };
    }

    private async doWork() {
        this.working = true;

        if (this.status === WorkerStatus.Done) {
            this.status = WorkerStatus.Working;
        }

        while (this.currentWorkingList.length > 0) {
            const currentTargetCoords = this.currentWorkingList.pop();
            const pixelColorInImage = this.getPixelColorFromImage(currentTargetCoords!.x,
                                                                  currentTargetCoords!.y);
            if (pixelColorInImage.a === 0) {
                // don't draw if alpha is 0
                continue;
            }

            const targetColor = colorConverter.convertActualColor(pixelColorInImage.r,
                                                                  pixelColorInImage.g,
                                                                  pixelColorInImage.b);
            const pixelNeedsPlacing = await this.doesPixelNeedReplacing(currentTargetCoords!.x,
                                                                        currentTargetCoords!.y,
                                                                        targetColor);

            if (pixelNeedsPlacing) {
                const postPixelResult = await this.chunkCache.retryPostPixel(currentTargetCoords!.x,
                                                                             currentTargetCoords!.y,
                                                                             targetColor);
// tslint:disable-next-line: max-line-length
                logger.log(`Just placed ${targetColor} at ${currentTargetCoords!.x}:${currentTargetCoords!.y}`);

                if (postPixelResult.waitSeconds > 50) {
                    const waitingFor = Math.floor(postPixelResult.waitSeconds - Math.random() * 40);

                    logger.log(`Pixels left to place/check: ${this.currentWorkingList.length}`);
                    logger.log(`Waiting for: ${waitingFor} seconds`);
                    await timeoutFor((waitingFor) * 1000);
                }
            }
        }

        // list is empty, job is done.
        if (this.status === WorkerStatus.Working) {
            this.status = WorkerStatus.Done;
        }

        this.working = false;
    }
}
