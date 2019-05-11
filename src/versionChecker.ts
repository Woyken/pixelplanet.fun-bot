import admZip from 'adm-zip';
import axios from 'axios';
import * as fs from 'fs-extra';
import logger from './logger';
import shelljs from 'shelljs';

class VersionChecker {
    public async start(): Promise<void> {
        logger.log('Checking for updates...');
// tslint:disable-next-line: max-line-length
        const response = await axios.get('https://raw.githubusercontent.com/Woyken/pixelplanet.fun-bot/master/package.json');
        const remotePackageData = response.data;
        const remoteVersion = remotePackageData.version;

        const data = fs.readFileSync('package.json');
        const packageData = JSON.parse(data as any);
        const currentVersion = packageData.version;
        if (this.compareVersions(remoteVersion, currentVersion) > 0) {
            logger.log('Newer version found, updating...');
// tslint:disable-next-line: max-line-length
            const updateResponse = await axios.get<Buffer>('https://nodeload.github.com/Woyken/pixelplanet.fun-bot/zip/master', { responseType: 'arraybuffer' });
            const zip = new admZip(updateResponse.data);
            zip.extractAllTo('./update');
            await fs.copy('./update/pixelplanet.fun-bot-master',
                          '.',
                          { overwrite: true, recursive: true });
            await fs.remove('./update');
            logger.log('Update complete. Restarting...');
            shelljs.exec(`npm start -- ${process.argv.slice(2).map((value) => {
                return `"${value}"`;
            }).join(' ')
            }`,          { async: false });

        } else {
            logger.log('Already up to date');
        }
        return;
    }

    private compareVersions(ver1: string, ver2: string) {
        const ver1Array = ver1.split('.').map((s) => {
            return parseInt(s, 10);
        });
        const ver2Array = ver2.split('.').map((s) => {
            return parseInt(s, 10);
        });
        for (let i = 0; i < 3; i++) {
            if (ver1Array[i] > ver2Array[i]) {
                return 1;
            }
            if (ver1Array[i] < ver2Array[i]) {
                return -1;
            }
        }
        return 0;
    }
}
export default new VersionChecker();
