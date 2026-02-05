import * as api from './api';

export const RingCentralService = {
    /**
     * Handle incoming ring event
     * returns the Contact ID to navigate to
     */
    handleIncomingCall: async (phoneNumber: string, assignedTo: string = ''): Promise<string> => {
        try {
            console.log('📞 Handling incoming call from:', phoneNumber);

            // 1. Search for existing contact
            const contacts = await api.fetchContacts(phoneNumber);
            const existingContact = contacts.find((c: any) => c.phone.includes(phoneNumber) || phoneNumber.includes(c.phone));

            if (existingContact) {
                console.log('✅ Found existing contact:', existingContact.name);
                if (assignedTo && existingContact.assignedTo !== assignedTo) {
                    await api.updateContact(existingContact.id, { ...existingContact, assignedTo });
                    console.log(`👤 Re-assigned contact to ${assignedTo}`);
                }
                return existingContact.id;
            }

            // 2. Create new contact if not found
            console.log('🆕 Creating new contact for:', phoneNumber);
            const newContact = {
                name: `New Caller ${phoneNumber}`,
                phone: phoneNumber,
                assignedTo: assignedTo, // Assign to the user getting the call
                status: 'New',
                notes: 'Created automatically via incoming call',
                createdAt: new Date().toISOString()
            };

            const created = await api.createContact(newContact);
            return created.id;

        } catch (error) {
            console.error('Error handling incoming call:', error);
            throw error;
        }
    },

    /**
     * Handle call end event to mark missed/declined
     */
    handleCallEnded: async (phoneNumber: string, status: string): Promise<void> => {
        try {
            console.log('📞 Handling call end:', phoneNumber, status);
            const contacts = await api.fetchContacts(phoneNumber);
            const contact = contacts.find((c: any) => c.phone.includes(phoneNumber) || phoneNumber.includes(c.phone));

            if (contact) {
                const isMissed = status === 'Missed' || status === 'Voicemail' || status === 'Rejected';
                // Only update if it was actually missed, or reset if we want to track 'last call outcome'
                // User asked to "mark missed", so we set missedCall = true.

                const updated = {
                    ...contact,
                    missedCall: isMissed,
                    declinedCall: status === 'Rejected',
                    // Optionally add to cellHistory or notes
                    notes: contact.notes + `\n[${new Date().toLocaleString()}] Call ${status}`
                };

                await api.updateContact(contact.id, updated);
                console.log(`✅ Marked contact ${contact.name} as ${status}`);
            }
        } catch (error) {
            console.error('Error handling call end:', error);
        }
    }
};
