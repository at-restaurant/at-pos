export function resolveConflict(local: any, remote: any, strategy: 'local' | 'remote' | 'merge' = 'remote') {
    if (strategy === 'local') return local
    if (strategy === 'remote') return remote

    // Merge strategy: Take latest by updated_at
    const localTime = new Date(local.updated_at || local.created_at).getTime()
    const remoteTime = new Date(remote.updated_at || remote.created_at).getTime()

    return remoteTime > localTime ? remote : local
}