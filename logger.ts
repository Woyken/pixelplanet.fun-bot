class Logger {
    public log(a: string) {
        // tslint:disable-next-line: no-console
        console.log(a);
    }

    public logWarn(a: string) {
        // tslint:disable-next-line: no-console
        console.warn(a);
    }

    public logError(a: string) {
        // tslint:disable-next-line: no-console
        console.error(a);
    }
}

export default new Logger();
