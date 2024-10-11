import { useEffect } from "react";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Config } from "../../../components/Solana/constants";
import { getAssetV1GpaBuilder, Key, updateAuthority } from "@metaplex-foundation/mpl-core";
import { AssetWithMetadata } from "../../../pages/collection/[pageName]";

export const useCheckNftBalance = (
  launch_key: PublicKey | null, 
  wallet: WalletContextState | null, 
  setOwnedAssets: (assets: AssetWithMetadata[]) => void, 
  setNFTBalance: (balance: number) => void
) => {

  useEffect(() => {
    const checkNftBalance = async () => {
      // Guard clauses to avoid unnecessary fetches if wallet or launch_key is null
      if (!launch_key || !wallet || !wallet.publicKey) return;

      const umi = createUmi(Config.RPC_NODE, "confirmed");
      const collection_umiKey = umiPublicKey(launch_key.toString());

      try {
        const assets = await getAssetV1GpaBuilder(umi)
          .whereField("key", Key.AssetV1)
          .whereField("updateAuthority", updateAuthority("Collection", [collection_umiKey]))
          .getDeserialized();

        let nftBalance = 0;
        let owned_assets: AssetWithMetadata[] = [];

        for (let i = 0; i < assets.length; i++) {
          if (assets[i].owner.toString() === wallet.publicKey.toString()) {
            nftBalance += 1;

            // Fetch metadata (URI JSON)
            const uri_json = await fetch(assets[i].uri).then((res) => res.json());
            const entry: AssetWithMetadata = { asset: assets[i], metadata: uri_json };
            owned_assets.push(entry);
          }
        }

        // Update state with owned assets and balance
        setOwnedAssets(owned_assets);
        setNFTBalance(nftBalance);

      } catch (error) {
        console.error("Failed to fetch NFT balance:", error);
      }
    };

    // Call the function to check NFT balance
    checkNftBalance();
    
  }, [launch_key, wallet, setOwnedAssets, setNFTBalance]); // Add all necessary dependencies here
};
