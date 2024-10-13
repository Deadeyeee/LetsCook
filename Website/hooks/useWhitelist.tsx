import { useState, useEffect } from 'react';

export const useWhitelist = (collectionPlugins, mintData) => {
    const [whitelist, setWhitelist] = useState(null);

    useEffect(() => {
        if (!collectionPlugins || !mintData || !collectionPlugins.whitelistKey) return;

        const whitelistKey = collectionPlugins.whitelistKey.toString();
        const whitelistData = mintData.get(whitelistKey);

        setWhitelist(whitelistData);
    }, [collectionPlugins, mintData]);

    return whitelist;
};