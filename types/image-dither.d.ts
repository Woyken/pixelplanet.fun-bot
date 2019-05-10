export = index;
declare class index {
    static matrices: {
        atkinson: {
            factor: number;
            x: number;
            y: number;
        }[];
        burkes: {
            factor: number;
            x: number;
            y: number;
        }[];
        floydSteinberg: {
            factor: number;
            x: number;
            y: number;
        }[];
        jarvisJudiceNinke: {
            factor: number;
            x: number;
            y: number;
        }[];
        none: any[];
        oneDimensional: {
            factor: number;
            x: number;
            y: number;
        }[];
        sierra2: {
            factor: number;
            x: number;
            y: number;
        }[];
        sierra3: {
            factor: number;
            x: number;
            y: number;
        }[];
        sierraLite: {
            factor: number;
            x: number;
            y: number;
        }[];
        stucki: {
            factor: number;
            x: number;
            y: number;
        }[];
    };
    constructor(options: any);
    options: any;
    dither(buffer: any, width: any, options: any): any;
}
