import logger from './logger';
import { Guid } from './guid';

export interface IProgramParameters {
    xLeftMost: number;
    yTopMost: number;
    imgPath: string;
    fingerprint: string;
    ditherTheImage: boolean;
    constantWatch: boolean;
    doNotOverrideColors: number[];
    customEdgesMapImagePath: string;
}

class UserInput {
    public currentParameters?: IProgramParameters;

    public async gatherProgramParameters(): Promise<void> {
        if (process.argv[3]) {
            return this.parseParametersFromArguments();
        }

        this.logInputErrorAndExit('Not enough parameters provided');
    }

    private printUsage() {
        logger.log(
            `
Program usage:
    npm start -- x y imgPath fingerprint [dither constantWatch customDrawPattern]

    Parameters:
    x - leftmost pixel of the pixture.
    y - topmost pixel of the picture.
    image - path to your image. Can be URL to image.
    fingerprint - your fingerprint.
    dither - "y/n" option to dither your image. Often used to compensate for lack of colors in new pallet.
    constantWatch - after finished painting, bot will continue to watch over the painting and defend against any attacks.
    customDrawPattern - path to image (same size as input image). Bot drawing will start from "whitest" color and end with "blackest".
            `,
        );
    }

    private logInputErrorAndExit(errorMessage: string) {
        logger.logError(`
-----------------------------------------
Error!
${errorMessage}`);
        this.printUsage();
        process.exit(0);
    }

    private parseParametersFromArguments() {
        const args = process.argv.slice(2);

        let xLeftMost: number;
        if (args[0]) {
            xLeftMost = parseInt(args[0], 10);
            logger.log(`x=${xLeftMost}`);
            if (xLeftMost === NaN) {
                this.logInputErrorAndExit(
                    'X value is not valid. Make sure your start command is correct.',
                );
                return;
            }
        } else {
            this.logInputErrorAndExit('X value is not provided');
            return;
        }

        let yTopMost: number;
        if (args[1]) {
            yTopMost = parseInt(args[1], 10);
            logger.log(`y=${yTopMost}`);
            if (yTopMost === NaN) {
                this.logInputErrorAndExit(
                    'Y value is not valid. Make sure your start command is correct.',
                );
                return;
            }
        } else {
            this.logInputErrorAndExit('Y value is not provided');
            return;
        }

        let imgPath: string;
        if (args[2]) {
            imgPath = args[2];
            logger.log(`imgPath=${imgPath}`);
        } else {
            this.logInputErrorAndExit('Path to image is not provided');
            return;
        }

        let fingerprint: string;
        if (args[3]) {
            fingerprint = args[3];
            logger.log(`fingerprint=${fingerprint}`);
            if (!Guid.validateGuid(fingerprint)) {
                this.logInputErrorAndExit(
                    'Fingerprint is invalid. Make sure your start command is correct.',
                );
                return;
            }
        } else {
            this.logInputErrorAndExit('Fingerprint is not provided');
            return;
        }

        let ditherTheImage: boolean = false;
        if (args[4]) {
            ditherTheImage = args[4].toLowerCase() === 'y';
        }
        logger.log(`Dither the image=${ditherTheImage}`);

        let constantWatch: boolean = false;
        if (args[5]) {
            constantWatch = args[5].toLowerCase() === 'y';
        }
        logger.log(`constantWatch=${constantWatch}`);

        const doNotOverrideColors: number[] = [];
        if (args[6]) {
            const inColorsStrArr = args[6].split(',');
            inColorsStrArr.forEach((el) => {
                doNotOverrideColors.push(parseInt(el, 10));
            });
        }

        let customEdgesMapImagePath: string = '';
        if (args[7]) {
            customEdgesMapImagePath = args[7];
            logger.log(`customEdgesMapImagePath=${customEdgesMapImagePath}`);
        }

        this.currentParameters = {
            constantWatch,
            customEdgesMapImagePath,
            ditherTheImage,
            doNotOverrideColors,
            fingerprint,
            imgPath,
            xLeftMost,
            yTopMost,
        };
    }
}

export default new UserInput();
