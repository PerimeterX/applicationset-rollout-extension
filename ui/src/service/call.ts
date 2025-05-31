function isUnauthorizedError(error: any): boolean {
    return error?.status === 401 || error?.response?.status === 401;
}

export function call<T>(fn: () => Promise<T>): Promise<T> {
    return callWithRetries(0, fn);
}

export async function callWithRetries<T>(retries: number, fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (isUnauthorizedError(error)) {
            const currentUrl = encodeURIComponent(window.location.href);
            window.location.href = `/login?return_url=${currentUrl}`;
            throw error;
        }
        if (retries > 0) {
            return callWithRetries(retries - 1, fn);
        }
        throw error;
    }
}