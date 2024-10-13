import { useEffect, useState, useCallback, useRef } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import { SYSTEM_KEY, PROGRAM, CollectionKeys, Config } from "../../components/Solana/constants";
import { request_assignment_data, AssignmentData } from "../../components/collection/collectionState";
import {request_raw_account_data} from "../../components/Solana/state";
import { useDisclosure } from "@chakra-ui/react";
import { useNftBalance } from "../../hooks/data/useNftBalance";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { fetchAssetV1, deserializeAssetV1, AssetV1 } from "@metaplex-foundation/mpl-core";
import useClaimNFT from "../../hooks/collections/useClaimNFT";

// Custom Hook to handle assignment data fetching and updates
const useAssignmentData = (
    wallet: any,
    collection: any,
    connection: Connection,
    setOraoRandoms: any,
    openAssetModal: () => void,
    refetch: () => void
) => {
    const [assignedNFT, setAssignedNFT] = useState<AssignmentData | null>(null);
    const mintNft = useRef<boolean>(false);
    const check_initial_assignment = useRef<boolean>(true);
    const nft_account_ws_id = useRef<number | null>(null);
    const asset_image = useRef<string | null>(null);
    const asset_received = useRef<AssetV1 | null>(null);

    // Function to handle updates when account changes are detected
    const checkAssignmentUpdate = useCallback(
        async (result: any) => {
            let event_data = result.data;
            let account_data = Buffer.from(event_data, "base64");

            if (account_data.length === 0) {
                setAssignedNFT(null);
                mintNft.current = false;
                return;
            }

            const [updated_data] = AssignmentData.struct.deserialize(account_data);
            if (assignedNFT !== null && updated_data.num_interations === assignedNFT.num_interations) {
                return;
            }

            if (!updated_data.random_address.equals(SYSTEM_KEY)) {
                openAssetModal();
            }

            if (updated_data.status < 2) {
                setAssignedNFT(updated_data);
                return;
            }

            let nft_index = updated_data.nft_index;
            let json_url = collection.nft_meta_url + nft_index + ".json";
            let uri_json = await fetch(json_url).then((res) => res.json());

            try {
                const umi = createUmi(Config.RPC_NODE, "confirmed");
                let asset_umiKey = publicKey(updated_data.nft_address.toString());
                const myAccount = await umi.rpc.getAccount(asset_umiKey);

                if (myAccount.exists) {
                    let asset = await deserializeAssetV1(myAccount);
                    asset_received.current = asset;
                    asset_image.current = await fetch(asset.uri).then((res) => res.json());
                    setAssignedNFT(updated_data);
                    refetch();
                }
            } catch (error) {
                setAssignedNFT(null);
            }

            mintNft.current = true;
            setAssignedNFT(updated_data);
        },
        [assignedNFT, collection, openAssetModal, refetch]
    );

    // Function to fetch assignment data initially
    const getAssignmentData = useCallback(async () => {
        if (!collection || !wallet) return;

        if (!check_initial_assignment.current) return;

        let nft_assignment_account = PublicKey.findProgramAddressSync(
            [wallet.publicKey.toBytes(), collection.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("assignment")],
            PROGRAM
        )[0];

        let assignment_data = await request_assignment_data(nft_assignment_account);
        check_initial_assignment.current = false;

        if (assignment_data && assignment_data.random_address.equals(SYSTEM_KEY) && assignment_data.status === 0) {
            let orao_data = await request_raw_account_data("", assignment_data.random_address);
            let orao_randomness = Array.from(orao_data.slice(8 + 32, 8 + 32 + 64));
            let valid = orao_randomness.some((num) => num !== 0);

            if (valid) {
                mintNft.current = true;
                setOraoRandoms(orao_randomness);
            }
        }

        setAssignedNFT(assignment_data);
    }, [collection, wallet]);

    // Setting up WebSocket listeners and initial fetching logic
    useEffect(() => {
        if (!collection || !wallet?.publicKey) return;

        if (!nft_account_ws_id.current) {
            let nft_assignment_account = PublicKey.findProgramAddressSync(
                [wallet.publicKey.toBytes(), collection.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("assignment")],
                PROGRAM
            )[0];

            nft_account_ws_id.current = connection.onAccountChange(
                nft_assignment_account,
                checkAssignmentUpdate,
                "confirmed"
            );
        }

        return () => {
            if (nft_account_ws_id.current !== null) {
                connection.removeAccountChangeListener(nft_account_ws_id.current);
                nft_account_ws_id.current = null;
            }
        };
    }, [wallet, connection, collection, checkAssignmentUpdate]);

    // Fetch assignment data when the hook is initialized
    useEffect(() => {
        getAssignmentData();
    }, [getAssignmentData]);

    return {
        assignedNFT,
        setAssignedNFT,
        setOraoRandoms,
        mintNft,
        asset_image,
        asset_received
    };
};

export default useAssignmentData;
