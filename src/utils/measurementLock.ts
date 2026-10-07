let tail: Promise<unknown> = Promise.resolve();

export function withMeasurementLock<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
}
