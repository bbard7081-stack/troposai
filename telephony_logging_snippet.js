// Diagnostic logging helper - add this after answeringParty detection
if (answeringParty) {
    const extId = answeringParty.extensionId || answeringParty.owner?.extensionId;
    console.log(`✅ [TELEPHONY] Answering Party Found: Extension ${extId} = ${STAFF_EXTENSIONS[extId]}`);
} else {
    const unknownAnswerer = parties.find(p => p.status?.code === 'Answered' && (p.extensionId || p.owner?.extensionId));
    if (unknownAnswerer) {
        const unknownExtId = unknownAnswerer.extensionId || unknownAnswerer.owner?.extensionId;
        console.log(`⚠️ [TELEPHONY] Unknown Extension Answered: ${unknownExtId} (Not in STAFF_EXTENSIONS map)`);
    } else {
        console.log(`⏳ [TELEPHONY] No Answered party found yet (call may still be ringing)`);
    }
}
