import { Dispatch, SetStateAction, useState, useCallback, useRef } from "react";

import {
    uInt32ToLEBytes,
    get_current_blockhash,
    send_transaction,
    serialise_EditLaunch_instruction,
    getRecentPrioritizationFees,
} from "../../components/Solana/state";
import { SOL_ACCOUNT_SEED, DEBUG, SYSTEM_KEY, PROGRAM, Config, DATA_ACCOUNT_SEED } from "../../components/Solana/constants";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction, Connection, ComputeBudgetProgram } from "@solana/web3.js";
import "react-time-picker/dist/TimePicker.css";
import "react-clock/dist/Clock.css";
import "react-datepicker/dist/react-datepicker.css";
import bs58 from "bs58";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
import useAppRoot from "../../context/useAppRoot";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { serialise_EditCollection_instruction } from "../../components/collection/collectionState";

const useEditCollection = () => {
    const wallet = useWallet();
    const router = useRouter();
    const { newCollectionData } = useAppRoot();
    const [isLoading, setIsLoading] = useState(false);

    const signature_ws_id = useRef<number | null>(null);

    const check_signature_update = useCallback(async (result: any) => {
        console.log(result);
        setIsLoading(false);
        signature_ws_id.current = null;

        // if we have a subscription field check against ws_id
        if (result.err !== null) {
            toast.error("Transaction failed, please try again");
            return;
        }

        toast.success("Successfuly Launched Collection!", {
            type: "success",
            isLoading: false,
            autoClose: 3000,
        });

        // reset the urls so we know these have been submitted
        newCollectionData.current.icon_url = "";
        newCollectionData.current.banner_url = "";
        newCollectionData.current.uri = "";
        newCollectionData.current.edit_mode = false;
        newCollectionData.current.token_keypair = null;
        newCollectionData.current.image_payment = false;
        newCollectionData.current.images_uploaded = 0;
        newCollectionData.current.manifest = null;
        newCollectionData.current.metadata_payment = false;
        newCollectionData.current.metadata_uploaded = false;

        router.push("/dashboard");
    }, []);

    const transaction_failed = useCallback(async () => {
        if (signature_ws_id.current == null) return;

        signature_ws_id.current = null;
        setIsLoading(false);

        toast.error("Transaction not processed, please try again", {
            type: "error",
            isLoading: false,
            autoClose: 3000,
        });
    }, []);

    const EditCollection = async () => {
        console.log("🟠 [EDIT COLLECTION] Starting EditCollection process...");

        if (wallet.publicKey === null || wallet.signTransaction === undefined) {
            console.error("❌ [EDIT COLLECTION] Wallet not connected or unable to sign transactions");
            return;
        }

        if (signature_ws_id.current !== null) {
            console.log("⚠️ [EDIT COLLECTION] Transaction already pending, skipping...");
            toast.success("Transaction pending, please wait");
            return;
        }

        console.log("🟠 [EDIT COLLECTION] Wallet connected:", wallet.publicKey.toString());
        console.log("🟠 [EDIT COLLECTION] Collection data:", {
            pagename: newCollectionData.current.pagename,
            team_wallet: newCollectionData.current.team_wallet,
            token_mint: newCollectionData.current.token_mint?.toString(),
        });

        const createLaunch = toast.info("Launching your collection (2/2)...");

        try {
            const connection = new Connection(Config.RPC_NODE, { wsEndpoint: Config.WSS_NODE });
            console.log("✅ [EDIT COLLECTION] Connection established");

            console.log("🟠 [EDIT COLLECTION] Creating account addresses...");
            let launch_data_account = PublicKey.findProgramAddressSync(
                [Buffer.from(newCollectionData.current.pagename), Buffer.from("Collection")],
                PROGRAM,
            )[0];

            let program_data_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(DATA_ACCOUNT_SEED)], PROGRAM)[0];

            let user_data_account = PublicKey.findProgramAddressSync([wallet.publicKey.toBytes(), Buffer.from("User")], PROGRAM)[0];

            let team_wallet = new PublicKey(newCollectionData.current.team_wallet);
            let program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

            console.log("🟠 [EDIT COLLECTION] Account addresses created:");
            console.log("🟠 [EDIT COLLECTION] - Launch data account:", launch_data_account.toString());
            console.log("🟠 [EDIT COLLECTION] - Program data account:", program_data_account.toString());
            console.log("🟠 [EDIT COLLECTION] - User data account:", user_data_account.toString());
            console.log("🟠 [EDIT COLLECTION] - Team wallet:", team_wallet.toString());
            console.log("🟠 [EDIT COLLECTION] - Program SOL account:", program_sol_account.toString());

            let token_mint = newCollectionData.current.token_mint;
            console.log("🟠 [EDIT COLLECTION] Getting mint info for:", token_mint.toString());
            let mint_info = await connection.getAccountInfo(token_mint);

            if (!mint_info) {
                console.error("❌ [EDIT COLLECTION] Mint info not found for token:", token_mint.toString());
                throw new Error("Token mint account not found");
            }

            console.log("✅ [EDIT COLLECTION] Mint info obtained, owner:", mint_info.owner.toString());

            console.log("🟠 [EDIT COLLECTION] Creating token account addresses...");
            let team_token_account_key = await getAssociatedTokenAddress(
                token_mint, // mint
                team_wallet, // owner
                true, // allow owner off curve
                mint_info.owner,
            );

            let pda_token_account_key = await getAssociatedTokenAddress(
                token_mint, // mint
                program_sol_account, // owner
                true, // allow owner off curve
                mint_info.owner,
            );

            console.log("🟠 [EDIT COLLECTION] Token account addresses:");
            console.log("🟠 [EDIT COLLECTION] - Team token account:", team_token_account_key.toString());
            console.log("🟠 [EDIT COLLECTION] - PDA token account:", pda_token_account_key.toString());

            console.log("🟠 [EDIT COLLECTION] Serializing instruction data...");
            const instruction_data = serialise_EditCollection_instruction(newCollectionData.current);
            console.log("✅ [EDIT COLLECTION] Instruction data serialized, length:", instruction_data.length);

            console.log("🟠 [EDIT COLLECTION] Building account vector...");
            var account_vector = [
                { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
                { pubkey: user_data_account, isSigner: false, isWritable: true },
                { pubkey: launch_data_account, isSigner: false, isWritable: true },
                { pubkey: program_sol_account, isSigner: false, isWritable: true },
                { pubkey: program_data_account, isSigner: false, isWritable: true },
                { pubkey: team_wallet, isSigner: false, isWritable: false },
                { pubkey: token_mint, isSigner: false, isWritable: true },
                { pubkey: team_token_account_key, isSigner: false, isWritable: true },
                { pubkey: pda_token_account_key, isSigner: false, isWritable: true },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSTEM_KEY, isSigner: false, isWritable: false },
                { pubkey: mint_info.owner, isSigner: false, isWritable: false },
            ];
            console.log("✅ [EDIT COLLECTION] Account vector built with", account_vector.length, "accounts");

            const list_instruction = new TransactionInstruction({
                keys: account_vector,
                programId: PROGRAM,
                data: instruction_data,
            });
            console.log("✅ [EDIT COLLECTION] Transaction instruction created");

            console.log("🟠 [EDIT COLLECTION] Getting current blockhash...");
            let txArgs = await get_current_blockhash("");
            console.log("✅ [EDIT COLLECTION] Blockhash obtained:", txArgs);

            console.log("🟠 [EDIT COLLECTION] Building transaction...");
            let transaction = new Transaction(txArgs);
            transaction.feePayer = wallet.publicKey;

            let feeMicroLamports = await getRecentPrioritizationFees(Config.PROD);
            transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: feeMicroLamports }));
            transaction.add(list_instruction);
            console.log("✅ [EDIT COLLECTION] Transaction built successfully");
            console.log("🟠 [EDIT COLLECTION] Transaction details:");
            console.log("🟠 [EDIT COLLECTION] - Instructions count:", transaction.instructions.length);
            console.log("🟠 [EDIT COLLECTION] - Fee payer:", transaction.feePayer?.toString());
            console.log("🟠 [EDIT COLLECTION] - Recent blockhash:", transaction.recentBlockhash);

            console.log("🟠 [EDIT COLLECTION] Requesting wallet signature...");
            let signed_transaction = await wallet.signTransaction(transaction);
            console.log("✅ [EDIT COLLECTION] Transaction signed by wallet successfully");

            console.log("🟠 [EDIT COLLECTION] Serializing transaction...");
            const serializedTransaction = signed_transaction.serialize();
            console.log("✅ [EDIT COLLECTION] Transaction serialized, size:", serializedTransaction.length, "bytes");

            console.log("🟠 [EDIT COLLECTION] Sending transaction to network...");
            var signature = await connection.sendRawTransaction(serializedTransaction, { skipPreflight: true });
            console.log("✅ [EDIT COLLECTION] Transaction sent, signature:", signature);

            if (signature === "INVALID") {
                console.error("❌ [EDIT COLLECTION] Invalid signature returned");
                toast.error("Transaction failed, please try again");
                return;
            }

            if (DEBUG) {
                console.log("🟠 [EDIT COLLECTION] Debug - edit collection signature:", signature);
            }

            console.log("🟠 [EDIT COLLECTION] Setting up signature confirmation listener...");
            signature_ws_id.current = connection.onSignature(signature, check_signature_update, "confirmed");
            setTimeout(transaction_failed, 20000);
            console.log("✅ [EDIT COLLECTION] Signature listener and timeout set");
        } catch (error) {
            console.error("❌ [EDIT COLLECTION] Critical error in EditCollection:", {
                error: error.message,
                stack: error.stack,
                name: error.name,
                cause: error.cause,
                code: error.code,
            });
            setIsLoading(false);
            toast.update(createLaunch, {
                render: "Something went wrong launching your collection. Error: " + error.message,
                type: "error",
                isLoading: false,
                autoClose: 3000,
            });
            return;
        }
    };
    return { EditCollection };
};

export default useEditCollection;
