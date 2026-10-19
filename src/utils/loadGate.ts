class LoadGate {
    private loads = 0;
    private active = 0;
    private waiters: (() => void)[] = [];

    private changed(): Promise<void> {
        return new Promise((resolve) => this.waiters.push(resolve));
    }

    private notify(): void {
        const waiting = this.waiters;
        this.waiters = [];
        for (const wake of waiting) wake();
    }

    async runPhaseOne<T>(task: () => Promise<T>): Promise<T> {
        while (this.loads > 0) await this.changed();
        this.active++;
        try {
            return await task();
        } finally {
            this.active--;
            this.notify();
        }
    }

    async runLoad<T>(task: () => Promise<T>): Promise<T> {
        this.loads++;
        try {
            while (this.active > 0) await this.changed();
            return await task();
        } finally {
            this.loads--;
            this.notify();
        }
    }
}

export const loadGate = new LoadGate();
export type { LoadGate };
