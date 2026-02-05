// Diagnostic logging helper - add this after answeringParty detection
if (answeringParty) {
    const extId = answeringParty.extensionId || answeringParty.owner?.extensionId;
} else {
    const unknownAnswerer = parties.find(p => p.status?.code === 'Answered' && (p.extensionId || p.owner?.extensionId));
    if (unknownAnswerer) {
        const unknownExtId = unknownAnswerer.extensionId || unknownAnswerer.owner?.extensionId;
    } else {
    }
}
