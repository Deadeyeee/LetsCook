import {
    LaunchData,
    LaunchInstruction,
    get_current_blockhash,
    myU64,
    send_transaction,
    serialise_basic_instruction,
    uInt32ToLEBytes,
    request_raw_account_data
} from "../../components/Solana/state";
import {
    CollectionData,
    AssignmentData,
    LookupData,
    request_assignment_data,
    request_lookup_data,
} from "../../components/collection/collectionState";
import {
    ComputeBudgetProgram,
    SYSVAR_RENT_PUBKEY,
    PublicKey,
    Transaction,
    TransactionInstruction,
    Connection,
    Keypair,
    AccountMeta
} from "@solana/web3.js";
import {
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    getAssociatedTokenAddressSync,
    unpackAccount,
    Account,
    getTransferHook,
    resolveExtraAccountMeta,
    ExtraAccountMetaAccountDataLayout
} from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    PROGRAM,
    RPC_NODE,
    SYSTEM_KEY,
    WSS_NODE,
    SOL_ACCOUNT_SEED,
    PYTH_BTC,
    PYTH_ETH,
    PYTH_SOL,
    CollectionKeys,
    METAPLEX_META,
    FEES_PROGRAM,
} from "../../components/Solana/constants";
import { useCallback, useRef, useState } from "react";
import bs58 from "bs58";
import { LaunchKeys, LaunchFlags } from "../../components/Solana/constants";
import useAppRoot from "../../context/useAppRoot";

const useWrapNFT = (launchData: CollectionData, updateData: boolean = false) => {
    const wallet = useWallet();
    const { checkProgramData, NFTLookup, mintData } = useAppRoot();

    const [isLoading, setIsLoading] = useState(false);

    const signature_ws_id = useRef<number | null>(null);

    const check_signature_update = useCallback(async (result: any) => {
        console.log(result);
        // if we have a subscription field check against ws_id
        if (result.err !== null) {
            alert("Transaction failed, please try again");
        }
        signature_ws_id.current = null;

        if (updateData) {
            await checkProgramData();
        }
    }, []);

    const WrapNFT = async () => {
        console.log("in mint nft");
        setIsLoading(true);

        if (wallet.signTransaction === undefined) {
            console.log(wallet, "invalid wallet");
            return;
        }

        if (wallet.publicKey.toString() == launchData.keys[LaunchKeys.Seller].toString()) {
            alert("Launch creator cannot buy tickets");
            return;
        }

        if (signature_ws_id.current !== null) {
            console.log("signature not null");
            alert("Transaction pending, please wait");
            return;
        }

        const connection = new Connection(RPC_NODE, { wsEndpoint: WSS_NODE });

        if (launchData === null) {
            console.log("launch is null");
            return;
        }

        let CollectionLookup = NFTLookup.current.get(launchData.keys[CollectionKeys.CollectionMint].toString());
        let token_addresses: PublicKey[] = [];
        let token_mints: PublicKey[] = [];

        let lookup_keys = CollectionLookup.keys()
        while(true) {
            let lookup_it = lookup_keys.next();
            if (lookup_it.done)
                break;

            let nft_mint = new PublicKey(lookup_it.value)
            let token_account = getAssociatedTokenAddressSync(
                nft_mint, // mint
                wallet.publicKey, // owner
                true, // allow owner off curve
                TOKEN_2022_PROGRAM_ID,
            );
            token_addresses.push(token_account);
            token_mints.push(nft_mint);
        }

        //console.log(token_addresses.length, " potential nfts found");
        let token_infos = await connection.getMultipleAccountsInfo(token_addresses, "confirmed");

        let valid_lookups: LookupData[] = [];
        for (let i = 0; i < token_infos.length; i++) {
            if ( token_infos[i] === null) {
                continue;
            }
            let account = unpackAccount(token_addresses[i], token_infos[i], TOKEN_2022_PROGRAM_ID);
            //console.log(account, token_mints[i].toString())
            if (account.amount > 0) {
                valid_lookups.push(CollectionLookup.get(token_mints[i].toString()));
            }
        }
        //console.log(valid_lookups);

        if (valid_lookups.length === 0) {
            console.log("no nfts owned by user")
            return;
        }

        let wrapped_index = Math.floor(Math.random() * valid_lookups.length);
        let wrapped_nft_key = valid_lookups[wrapped_index].nft_mint;

        let program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

        let nft_lookup_account = PublicKey.findProgramAddressSync(
            [
                launchData.keys[CollectionKeys.CollectionMint].toBytes(),
                uInt32ToLEBytes(valid_lookups[wrapped_index].nft_index),
                Buffer.from("Lookup"),
            ],
            PROGRAM,
        )[0];

        let nft_token_account = await getAssociatedTokenAddress(
            wrapped_nft_key, // mint
            wallet.publicKey, // owner
            true, // allow owner off curve
            TOKEN_2022_PROGRAM_ID,
        );

        let nft_escrow_account = await getAssociatedTokenAddress(
            wrapped_nft_key, // mint
            program_sol_account, // owner
            true, // allow owner off curve
            TOKEN_2022_PROGRAM_ID,
        );

        let launch_data_account = PublicKey.findProgramAddressSync(
            [Buffer.from(launchData.page_name), Buffer.from("Collection")],
            PROGRAM,
        )[0];

        let token_mint = launchData.keys[CollectionKeys.MintAddress];

        let user_token_account_key = await getAssociatedTokenAddress(
            token_mint, // mint
            wallet.publicKey, // owner
            true, // allow owner off curve
            TOKEN_2022_PROGRAM_ID,
        );

        let pda_token_account_key = await getAssociatedTokenAddress(
            token_mint, // mint
            program_sol_account, // owner
            true, // allow owner off curve
            TOKEN_2022_PROGRAM_ID,
        );

        let team_token_account_key = await getAssociatedTokenAddress(
            token_mint, // mint
            launchData.keys[CollectionKeys.TeamWallet], // owner
            true, // allow owner off curve
            TOKEN_2022_PROGRAM_ID,
        );


        let mint_account = mintData.get(launchData.keys[CollectionKeys.MintAddress].toString())
        let transfer_hook = getTransferHook(mint_account);

        let transfer_hook_program_account: PublicKey | null = null;
        let transfer_hook_validation_account: PublicKey | null = null;
        let extra_hook_accounts: AccountMeta[] = [];
        if (transfer_hook !== null) {
            console.log(transfer_hook.programId.toString());

            transfer_hook_program_account = transfer_hook.programId;
            transfer_hook_validation_account = PublicKey.findProgramAddressSync(
                [Buffer.from("extra-account-metas"), launchData.keys[CollectionKeys.MintAddress].toBuffer()],
                transfer_hook_program_account,
            )[0];

            // check if the validation account exists
            console.log("check extra accounts");
            let hook_accounts = await request_raw_account_data("", transfer_hook_validation_account);

            let extra_account_metas = ExtraAccountMetaAccountDataLayout.decode(hook_accounts);
            console.log(extra_account_metas);
            for (let i = 0; i < extra_account_metas.extraAccountsList.count; i++) {
                console.log(extra_account_metas.extraAccountsList.extraAccounts[i]);
                let extra = extra_account_metas.extraAccountsList.extraAccounts[i];
                let meta = await resolveExtraAccountMeta(
                    connection,
                    extra,
                    extra_hook_accounts,
                    Buffer.from([]),
                    transfer_hook_program_account,
                );
                console.log(meta);
                extra_hook_accounts.push(meta);
            }

            if (transfer_hook_program_account === FEES_PROGRAM) {
                extra_hook_accounts[0].isWritable = true;
            }
        }

        const instruction_data = serialise_basic_instruction(LaunchInstruction.wrap_nft);

        var account_vector = [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: nft_lookup_account, isSigner: false, isWritable: true },

            { pubkey: launch_data_account, isSigner: false, isWritable: true },
            { pubkey: program_sol_account, isSigner: false, isWritable: true },

            { pubkey: token_mint, isSigner: false, isWritable: true },
            { pubkey: user_token_account_key, isSigner: false, isWritable: true },
            { pubkey: pda_token_account_key, isSigner: false, isWritable: true },
            { pubkey: team_token_account_key, isSigner: false, isWritable: true },

            { pubkey: wrapped_nft_key, isSigner: false, isWritable: true },
            { pubkey: nft_token_account, isSigner: false, isWritable: true },
            { pubkey: nft_escrow_account, isSigner: false, isWritable: true },
        ];

        account_vector.push({ pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false });
        account_vector.push({ pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false });
        account_vector.push({ pubkey: SYSTEM_KEY, isSigner: false, isWritable: true });

        if (transfer_hook_program_account !== null) {
            
            account_vector.push({ pubkey: transfer_hook_program_account, isSigner: false, isWritable: true });

            if (transfer_hook_program_account.equals(FEES_PROGRAM)) {
                account_vector.push({
                    pubkey: extra_hook_accounts[0].pubkey,
                    isSigner: extra_hook_accounts[0].isSigner,
                    isWritable: true,
                });
            }
            
            account_vector.push({ pubkey: transfer_hook_validation_account, isSigner: false, isWritable: true });

            for (let i = 0; i < extra_hook_accounts.length; i++) {
                account_vector.push({
                    pubkey: extra_hook_accounts[i].pubkey,
                    isSigner: extra_hook_accounts[i].isSigner,
                    isWritable: extra_hook_accounts[i].isWritable,
                });
            }

            
        }

        const list_instruction = new TransactionInstruction({
            keys: account_vector,
            programId: PROGRAM,
            data: instruction_data,
        });

        let txArgs = await get_current_blockhash("");

        let transaction = new Transaction(txArgs);
        transaction.feePayer = wallet.publicKey;

        transaction.add(list_instruction);
        transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

        try {
            let signed_transaction = await wallet.signTransaction(transaction);
            const encoded_transaction = bs58.encode(signed_transaction.serialize());

            var transaction_response = await send_transaction("", encoded_transaction);

            let signature = transaction_response.result;

            console.log("join sig: ", signature);

            signature_ws_id.current = connection.onSignature(signature, check_signature_update, "confirmed");
        } catch (error) {
            console.log(error);
            return;
        } finally {
            setIsLoading(false);
        }
    };

    return { WrapNFT, isLoading };
};

export default useWrapNFT;