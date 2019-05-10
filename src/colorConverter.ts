class ColorConverter {
    private colorDict: { [id: number]: [number, number, number]; } = {};

    constructor() {
        this.colorDict[2] = this.parseColor('#ffffff');
        this.colorDict[3] = this.parseColor('#e4e4e4');
        this.colorDict[4] = this.parseColor('#888888');
        this.colorDict[5] = this.parseColor('#4e4e4e');
        this.colorDict[6] = this.parseColor('#000000');
        this.colorDict[7] = this.parseColor('#f4b3ae');
        this.colorDict[8] = this.parseColor('#ffa7d1');
        this.colorDict[9] = this.parseColor('#ff6565');
        this.colorDict[10] = this.parseColor('#e50000');
        this.colorDict[11] = this.parseColor('#fea460');
        this.colorDict[12] = this.parseColor('#e59500');
        this.colorDict[13] = this.parseColor('#a06a42');
        this.colorDict[14] = this.parseColor('#f5dfb0');
        this.colorDict[15] = this.parseColor('#e5d900');
        this.colorDict[16] = this.parseColor('#94e044');
        this.colorDict[17] = this.parseColor('#02be01');
        this.colorDict[18] = this.parseColor('#006513');
        this.colorDict[19] = this.parseColor('#cae3ff');
        this.colorDict[20] = this.parseColor('#00d3dd');
        this.colorDict[21] = this.parseColor('#0083c7');
        this.colorDict[22] = this.parseColor('#0000ea');
        this.colorDict[23] = this.parseColor('#191973');
        this.colorDict[24] = this.parseColor('#cf6ee4');
        this.colorDict[25] = this.parseColor('#820080');
    }

    public convertActualColor(r: number, g: number, b: number): number {
        let lowestDiff = 99999999;
        let resultColor = -1;
        for (const key in this.colorDict) {
            if (!key) {
                continue;
            }
            const value = this.colorDict[key];
            const difference = Math.sqrt(
                Math.pow(r - value[0], 2) +
                Math.pow(g - value[1], 2) +
                Math.pow(b - value[2], 2),
                );
            if (difference < lowestDiff) {
                lowestDiff = difference;
                resultColor = parseInt(key, 10);
            }
        }
        return resultColor;
    }

    public getActualColor(color: number): [number, number, number] {
        switch (color) {
        case 0:
// tslint:disable-next-line: no-parameter-reassignment
            color = 19;
            break;
        case 1:
// tslint:disable-next-line: no-parameter-reassignment
            color = 2;
        default:
            break;
        }
        return [this.colorDict[color][0], this.colorDict[color][1], this.colorDict[color][2]];
    }

    public areColorsEqual(c1: number, c2: number): boolean {
        if (c1 === c2) {
            return true;
        }
        // default ocean color
        if ((c1 === 0 && c2 === 19) || c1 === 19 && c2 === 0) {
            return true;
        }
        // default ground color
        if ((c1 === 1 && c2 === 2) || c1 === 2 && c2 === 1) {
            return true;
        }
        return false;
    }

    private parseColor(colorStr: string): [number, number, number] {
        const r = parseInt(colorStr.substr(1, 2), 16);
        const g = parseInt(colorStr.substr(3, 2), 16);
        const b = parseInt(colorStr.substr(5, 2), 16);
        return [r, g, b];
    }
}

export default new ColorConverter();
