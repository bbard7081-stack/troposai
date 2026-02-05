import React, { useEffect } from 'react';

const RingCentralWidget: React.FC = () => {
    useEffect(() => {

        // Check if script is already present
        if (document.getElementById('rc-adapter-script')) {
            return;
        }

        const clientId = import.meta.env.VITE_RC_CLIENT_ID;
        const serverUrl = import.meta.env.VITE_RC_SERVER_URL;

        // Use local redirect.html for better browser compatibility on IP-based origins
        const redirectUri = window.location.origin + '/redirect.html';


        const script = document.createElement('script');
        script.src = `https://ringcentral.github.io/ringcentral-embeddable/adapter.js?clientId=${clientId}&appServer=${serverUrl}&redirectUri=${redirectUri}`;
        script.id = 'rc-adapter-script';
        script.async = true;

        script.onload = () => {
        };

        script.onerror = (err) => {
            console.error('❌ RingCentralWidget: Failed to load adapter script', err);
        };

        document.body.appendChild(script);
    }, []);

    return (
        // The widget injects itself into the DOM, but we can verify it's loaded 
        // This component acts mainly as the initializer
        null
    );
};

export default RingCentralWidget;
