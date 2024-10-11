import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { getAssetV1GpaBuilder, updateAuthority, Key, AssetV1 } from "@metaplex-foundation/mpl-core";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { AssetWithMetadata } from "../../pages/collection/[pageName]";  // Define this based on your use case
import { Config } from "../../components/Solana/constants";  // Your config file with RPC_NODE or other configurations

export const useNftBalance = (launchKey: PublicKey | null, wallet: WalletContextState) => {
    const [ownedAssets, setOwnedAssets] = useState<AssetWithMetadata[]>([]);
    const [nftBalance, setNftBalance] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const checkNftBalance = useCallback(async () => {
        if (!launchKey || !wallet?.publicKey) {
            setError("Invalid launch key or wallet not connected");
            return;
        }

        try {
            setLoading(true);
            const umi = createUmi(Config.RPC_NODE, "confirmed");
            const collectionUmiKey = publicKey(launchKey.toString());

            const assets = await getAssetV1GpaBuilder(umi)
                .whereField("key", Key.AssetV1)
                .whereField("updateAuthority", updateAuthority("Collection", [collectionUmiKey]))
                .getDeserialized();

            let validLookups = 0;
            let ownedAssetsData: AssetWithMetadata[] = [];

            for (const asset of assets) {
                if (asset.owner.toString() === wallet.publicKey.toString()) {
                    validLookups += 1;
                    const uriJson = await fetch(asset.uri).then(res => res.json());
                    ownedAssetsData.push({ asset, metadata: uriJson });
                }
            }

            setOwnedAssets(ownedAssetsData);
            setNftBalance(validLookups);
        } catch (err) {
            console.error("Failed to check NFT balance:", err);
            setError("Failed to check NFT balance");
        } finally {
            setLoading(false);
        }
        console.log("nftBalance", nftBalance)
    }, [launchKey, wallet]);

    useEffect(() => {
        checkNftBalance();
    }, [checkNftBalance]);

    return { ownedAssets, nftBalance, loading, error, refetch: checkNftBalance };
};
