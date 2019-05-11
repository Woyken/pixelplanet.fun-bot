import axios from 'axios';

interface RemoteData {
    exclusions: RemoteDataExclusion[];
}

interface RemoteDataExclusion {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
}

export class SpecialExclusionHandler {
// tslint:disable-next-line: max-line-length
    private link: string = 'https://dl.dropboxusercontent.com/s/bqggjhtz5rx9leo/pixelBotExclusions.json';
    private cachedData?: RemoteData;

    private constructor() {
        setInterval(async () => {
            await this.updateData();
        },          1000 * 60 * 5);
    }

    public static async create(): Promise<SpecialExclusionHandler> {
        const handler = new SpecialExclusionHandler();
        await handler.updateData();
        return handler;
    }

    private async updateData() {
        const response = await axios.get(this.link);
        const remoteData = response.data;
        this.cachedData = remoteData;
    }

    public isPixelExcluded(x: number, y: number): boolean {
        if (this.cachedData) {
            for (let i = 0; i < this.cachedData.exclusions.length; i++) {
                const element = this.cachedData.exclusions[i];
                if (this.isInBounds(x, y, element)) {
                    return true;
                }
            }
        }
        return false;
    }

    private isInBounds(x: number, y: number, exclusion: RemoteDataExclusion): boolean {
        if (x < exclusion.x1) {
            return false;
        }
        if (x > exclusion.x2) {
            return false;
        }
        if (y < exclusion.y1) {
            return false;
        }
        if (y > exclusion.y2) {
            return false;
        }
        return true;
    }
}
