import { Dispatch, SetStateAction, useRef, useState, useCallback } from "react";
import styles from "../../styles/LaunchDetails.module.css";

import { Center, VStack, Text, Input, HStack, InputGroup, InputLeftElement, Spinner } from "@chakra-ui/react";

import {
    CORE,
    DEBUG,
    SYSTEM_KEY,
    PROGRAM,
    DEFAULT_FONT_SIZE,
    LaunchKeys,
    Config,
    SOL_ACCOUNT_SEED,
    DATA_ACCOUNT_SEED,
} from "../../components/Solana/constants";
import {
    LaunchDataUserInput,
    get_current_blockhash,
    request_current_balance,
    uInt32ToLEBytes,
    getRecentPrioritizationFees,
} from "../../components/Solana/state";
import { serialise_LaunchCollection_instruction } from "./collectionState";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    Connection,
    ComputeBudgetProgram,
    SYSVAR_RENT_PUBKEY,
    SystemProgram,
} from "@solana/web3.js";
import bs58 from "bs58";

import useResponsive from "../../hooks/useResponsive";
import { useRouter } from "next/router";
import useAppRoot from "../../context/useAppRoot";
import { toast } from "react-toastify";
import { RxSlash } from "react-icons/rx";
import Image from "next/image";
import useEditCollection from "../../hooks/collections/useEditCollection";
import { useIrysUploader } from "../../hooks/useIrysUploader";

type TaggedFile = File & {
    tags?: { name: string; value: string }[];
};
import { Button } from "../ui/button";

interface CollectionPageProps {
    setScreen: Dispatch<SetStateAction<string>>;
}

// Define the Tag type
type Tag = {
    name: string;
    value: string;
};

const CollectionPage = ({ setScreen }: CollectionPageProps) => {
    const router = useRouter();
    const { sm, md, lg, xl } = useResponsive();
    const wallet = useWallet();
    const { newCollectionData } = useAppRoot();

    const [isLoading, setIsLoading] = useState(false);

    const [name, setName] = useState<string>(newCollectionData.current.pagename);
    const [web, setWeb] = useState<string>(newCollectionData.current.web_url);
    const [telegram, setTelegram] = useState<string>(newCollectionData.current.tele_url);
    const [twitter, setTwitter] = useState(newCollectionData.current.twt_url);
    const [discord, setDiscord] = useState(newCollectionData.current.disc_url);
    const [banner_name, setBannerName] = useState<string>("");
    const signature_ws_id = useRef<number | null>(null);

    const { EditCollection } = useEditCollection();

    const { irysUploader, isLoading: irysLoading, uploadFiles } = useIrysUploader();

    const handleNameChange = (e) => {
        setName(e.target.value);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files && e.target.files[0];

        if (file) {
            if (file.size <= 4194304) {
                newCollectionData.current.banner_file = file;
                setBannerName(file.name);
            } else {
                alert("File size exceeds 4MB limit.");
            }
        }
    };

    function containsNone(str: string, set: string[]) {
        return str.split("").every(function (ch) {
            return set.indexOf(ch) === -1;
        });
    }

    const check_signature_update = useCallback(
        async (result: any) => {
            console.log("🔔 [SIGNATURE UPDATE] Signature confirmation received:", result);
            // if we have a subscription field check against ws_id

            signature_ws_id.current = null;
            setIsLoading(false);

            if (result.err !== null) {
                console.error("❌ [SIGNATURE UPDATE] Transaction failed with error:", result.err);
                toast.error("Transaction failed, please try again", {
                    type: "error",
                    isLoading: false,
                    autoClose: 3000,
                });
                return;
            }

            console.log("✅ [SIGNATURE UPDATE] Main transaction confirmed successfully");
            toast.success("Launch (1/2) Complete", {
                type: "success",
                isLoading: false,
                autoClose: 3000,
            });

            console.log("🔵 [SIGNATURE UPDATE] Calling EditCollection for step 2...");
            try {
                await EditCollection();
                console.log("✅ [SIGNATURE UPDATE] EditCollection completed successfully");
            } catch (error) {
                console.error("❌ [SIGNATURE UPDATE] Error in EditCollection:", {
                    error: error.message,
                    stack: error.stack,
                    name: error.name,
                    cause: error.cause,
                });
                toast.error("Error in collection finalization: " + error.message);
            }
        },
        [EditCollection],
    );

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

    async function setData(e): Promise<boolean> {
        e.preventDefault();

        let invalid_chars = [
            ":",
            "/",
            "?",
            "#",
            "[",
            "]",
            "@",
            "&",
            "=",
            "+",
            "$",
            ",",
            "{",
            "}",
            "|",
            "\\",
            "^",
            "~",
            "`",
            "<",
            ">",
            "%",
            " ",
            '"',
        ];
        console.log("invalid chars:", invalid_chars);

        if (!containsNone(name, invalid_chars)) {
            toast.error("Page name contains invalid characters for URL");
            return false;
        }

        if (name === "") {
            toast.error("Please enter a page name");
            return false;
        }

        if (newCollectionData.current.banner_file === null) {
            toast.error("Please select a banner image.");
            return false;
        }

        let launch_data_account = PublicKey.findProgramAddressSync([Buffer.from(name), Buffer.from("Collection")], PROGRAM)[0];

        let balance = 0;

        if (newCollectionData.current.edit_mode === false) {
            balance = await request_current_balance("", launch_data_account);
        }

        console.log("check balance", name, launch_data_account.toString(), balance);

        if (balance > 0 && newCollectionData.current.uri == "") {
            toast.error("Page name already exists");
            return false;
        }

        newCollectionData.current.pagename = name;
        newCollectionData.current.web_url = web;
        newCollectionData.current.twt_url = twitter;
        newCollectionData.current.disc_url = discord;
        newCollectionData.current.tele_url = telegram;

        return true;
    }

    async function nextPage(e) {
        if (await setData(e)) setScreen("book");
    }

    async function prevPage(e) {
        if (await setData(e)) setScreen("step 3");
    }

    async function Launch(e) {
        if (await setData(e)) CreateLaunch();
    }

    const CreateLaunch = useCallback(async () => {
        console.log("🚀 [COLLECTION CREATION] Starting collection creation process...");

        if (wallet.publicKey === null || wallet.signTransaction === undefined) {
            console.error("❌ [COLLECTION CREATION] Wallet not connected or unable to sign transactions");
            return;
        }

        console.log("🔵 [COLLECTION CREATION] Wallet connected:", wallet.publicKey.toString());

        console.log("🔵 [COLLECTION CREATION] Collection data check:");
        console.log("🔵 [COLLECTION CREATION] Icon URL:", newCollectionData.current.icon_url);
        console.log("🔵 [COLLECTION CREATION] Banner URL:", newCollectionData.current.banner_url);
        console.log("🔵 [COLLECTION CREATION] Edit mode:", newCollectionData.current.edit_mode);

        // if this is in edit mode then just call that function
        if (newCollectionData.current.edit_mode === true) {
            console.log("🔵 [COLLECTION CREATION] Edit mode detected, calling EditCollection...");
            await EditCollection();
            return;
        }

        // check if the launch account already exists, if so just skip all this
        console.log("🔵 [COLLECTION CREATION] Checking if launch account already exists...");
        let test_launch_data_account = PublicKey.findProgramAddressSync(
            [Buffer.from(newCollectionData.current.pagename), Buffer.from("Collection")],
            PROGRAM,
        )[0];

        console.log("🔵 [COLLECTION CREATION] Test launch data account:", test_launch_data_account.toString());
        console.log("🔵 [COLLECTION CREATION] Requesting balance for launch account...");

        let account_balance = await request_current_balance("", test_launch_data_account);
        console.log("🔵 [COLLECTION CREATION] Launch account balance:", account_balance);

        if (account_balance > 0) {
            console.log("🔵 [COLLECTION CREATION] Account already exists, calling EditCollection...");
            await EditCollection();
            return;
        }

        console.log("✅ [COLLECTION CREATION] Launch account doesn't exist yet, proceeding with creation...");

        setIsLoading(true);

        const connection = new Connection(Config.RPC_NODE, { wsEndpoint: Config.WSS_NODE });

        let feeMicroLamports = await getRecentPrioritizationFees(Config.PROD);

        if (newCollectionData.current.icon_url == "" || newCollectionData.current.banner_url == "") {
            console.log("🔵 [IMAGE UPLOAD] Starting image upload process...");

            let file_list: File[] = [];
            file_list.push(newCollectionData.current.icon_file);
            file_list.push(newCollectionData.current.banner_file);
            for (let i = 0; i < newCollectionData.current.nft_images.length; i++) {
                file_list.push(newCollectionData.current.nft_images[i]);
            }

            console.log("🔵 [IMAGE UPLOAD] Files to upload:", file_list.length);
            console.log(
                "🔵 [IMAGE UPLOAD] Total size:",
                file_list.reduce((sum, f) => sum + f.size, 0),
                "bytes",
            );

            try {
                const receipt = await uploadFiles(file_list, "images");

                if (!receipt) {
                    console.error("❌ [IMAGE UPLOAD] Upload failed - no receipt returned");
                    setIsLoading(false);
                    return;
                }

                console.log("✅ [IMAGE UPLOAD] Upload successful, manifest ID:", receipt.manifestId);

                let manifestId = receipt.manifestId;
                let icon_url = "https://gateway.irys.xyz/" + manifestId + "/" + newCollectionData.current.icon_file.name;
                let banner_url = "https://gateway.irys.xyz/" + manifestId + "/" + newCollectionData.current.banner_file.name;

                newCollectionData.current.icon_url = icon_url;
                newCollectionData.current.banner_url = banner_url;
                newCollectionData.current.nft_image_url = "https://gateway.irys.xyz/" + manifestId + "/";

                console.log("✅ [IMAGE UPLOAD] URLs set successfully");
            } catch (error) {
                console.error("❌ [IMAGE UPLOAD] Failed to upload images:", error);
                toast.error("Failed to upload images: " + error.message);
                setIsLoading(false);
                return;
            }
        }

        if (newCollectionData.current.uri == "") {
            console.log("🔵 [METADATA UPLOAD] Starting metadata upload process...");

            var metadata = {
                name: newCollectionData.current.collection_name,
                symbol: newCollectionData.current.collection_symbol,
                description: newCollectionData.current.description,
                image: newCollectionData.current.icon_url,
            };

            const jsn = JSON.stringify(metadata);
            const blob = new Blob([jsn], { type: "application/json" });
            const json_file = new File([blob], "metadata.json");

            let file_list: File[] = [];
            file_list.push(json_file);

            console.log("🔵 [METADATA UPLOAD] Processing NFT metadata files:", newCollectionData.current.nft_metadata.length);

            for (let i = 0; i < newCollectionData.current.nft_metadata.length; i++) {
                try {
                    console.log(
                        `🔵 [METADATA PROCESSING] Processing file ${i + 1}/${newCollectionData.current.nft_metadata.length}: ${newCollectionData.current.nft_metadata[i].name}`,
                    );

                    let text = await newCollectionData.current.nft_metadata[i].text();
                    console.log(`✅ [METADATA PROCESSING] File content read successfully, length: ${text.length} characters`);

                    let json = JSON.parse(text);
                    console.log(`✅ [METADATA PROCESSING] JSON parsed successfully`);

                    let index = newCollectionData.current.nft_metadata[i].name.split(".")[0];
                    json["image"] = newCollectionData.current.nft_image_url + index + newCollectionData.current.nft_type;

                    const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
                    const processed_file = new File([blob], newCollectionData.current.nft_metadata[i].name);
                    file_list.push(processed_file);

                    console.log(`✅ [METADATA PROCESSING] File ${i + 1} processed successfully`);
                } catch (error) {
                    console.error(
                        `❌ [METADATA PROCESSING] Error processing file ${i + 1} (${newCollectionData.current.nft_metadata[i].name}):`,
                        error,
                    );
                    toast.error(
                        `Failed to process metadata file: ${newCollectionData.current.nft_metadata[i].name}. Please check the file format.`,
                        {
                            type: "error",
                            isLoading: false,
                            autoClose: 5000,
                        },
                    );
                    setIsLoading(false);
                    return;
                }
            }

            console.log("🔵 [METADATA UPLOAD] Files to upload:", file_list.length);
            console.log(
                "🔵 [METADATA UPLOAD] Total size:",
                file_list.reduce((sum, f) => sum + f.size, 0),
                "bytes",
            );

            try {
                const json_receipt = await uploadFiles(file_list, "metadata");

                if (!json_receipt) {
                    console.error("❌ [METADATA UPLOAD] Upload failed - no receipt returned");
                    setIsLoading(false);
                    return;
                }

                console.log("✅ [METADATA UPLOAD] Upload successful, manifest ID:", json_receipt.manifestId);

                let manifestId = json_receipt.manifestId;
                let collection_meta_url = "https://gateway.irys.xyz/" + json_receipt.manifest.paths[json_file.name].id;

                newCollectionData.current.uri = collection_meta_url;
                newCollectionData.current.nft_metadata_url = "https://gateway.irys.xyz/" + manifestId + "/";

                console.log(
                    "✅ [METADATA UPLOAD] URLs set successfully:",
                    newCollectionData.current.uri,
                    newCollectionData.current.nft_metadata_url,
                );
            } catch (error) {
                console.error("❌ [METADATA UPLOAD] Failed to upload metadata:", error);
                toast.error("Failed to upload metadata: " + error.message);
                setIsLoading(false);
                return;
            }
        }

        let program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

        let launch_data_account = PublicKey.findProgramAddressSync(
            [Buffer.from(newCollectionData.current.pagename), Buffer.from("Collection")],
            PROGRAM,
        )[0];

        let team_wallet = new PublicKey(newCollectionData.current.team_wallet);

        var collection_mint_pubkey = newCollectionData.current.token_keypair.publicKey;

        console.log("mint", collection_mint_pubkey.toString());

        let whitelist_key = PROGRAM;
        if (newCollectionData.current.whitelist_key !== "") {
            whitelist_key = new PublicKey(newCollectionData.current.whitelist_key);
        }

        console.log("🔵 [COLLECTION CREATION] Creating transaction instruction...");
        const createLaunch = toast.info("(3/4) Setting up your launch accounts");

        try {
            const instruction_data = serialise_LaunchCollection_instruction(newCollectionData.current);
            console.log("✅ [COLLECTION CREATION] Instruction data serialized successfully");
            console.log("🔵 [COLLECTION CREATION] Instruction data length:", instruction_data.length);

            console.log("🔵 [COLLECTION CREATION] Building account vector...");
            console.log("🔵 [COLLECTION CREATION] Wallet public key:", wallet.publicKey.toString());
            console.log("🔵 [COLLECTION CREATION] Launch data account:", launch_data_account.toString());
            console.log("🔵 [COLLECTION CREATION] Program SOL account:", program_sol_account.toString());
            console.log("🔵 [COLLECTION CREATION] Collection mint pubkey:", collection_mint_pubkey.toString());
            console.log("🔵 [COLLECTION CREATION] Token mint:", newCollectionData.current.token_mint.toString());
            console.log("🔵 [COLLECTION CREATION] Team wallet:", team_wallet.toString());
            console.log("🔵 [COLLECTION CREATION] Whitelist key:", whitelist_key.toString());

            var account_vector = [
                { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
                { pubkey: launch_data_account, isSigner: false, isWritable: true },
                { pubkey: program_sol_account, isSigner: false, isWritable: true },
                { pubkey: collection_mint_pubkey, isSigner: true, isWritable: true },
                { pubkey: newCollectionData.current.token_mint, isSigner: false, isWritable: true },
                { pubkey: team_wallet, isSigner: false, isWritable: false },
                { pubkey: whitelist_key, isSigner: false, isWritable: false },
            ];
            account_vector.push({ pubkey: SYSTEM_KEY, isSigner: false, isWritable: true });
            account_vector.push({ pubkey: CORE, isSigner: false, isWritable: false });

            console.log("✅ [COLLECTION CREATION] Account vector built with", account_vector.length, "accounts");

            const list_instruction = new TransactionInstruction({
                keys: account_vector,
                programId: PROGRAM,
                data: instruction_data,
            });
            console.log("✅ [COLLECTION CREATION] Transaction instruction created");

            console.log("🔵 [COLLECTION CREATION] Getting current blockhash...");
            let txArgs = await get_current_blockhash("");
            console.log("✅ [COLLECTION CREATION] Blockhash obtained:", txArgs);

            console.log("🔵 [COLLECTION CREATION] Building transaction...");
            let transaction = new Transaction(txArgs);
            transaction.feePayer = wallet.publicKey;
            transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: feeMicroLamports }));
            transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
            transaction.add(list_instruction);
            console.log("✅ [COLLECTION CREATION] Transaction built successfully");

            console.log("🔵 [COLLECTION CREATION] Partially signing with token keypair...");
            console.log("🔵 [COLLECTION CREATION] Token keypair public key:", newCollectionData.current.token_keypair.publicKey.toString());
            transaction.partialSign(newCollectionData.current.token_keypair);
            console.log("✅ [COLLECTION CREATION] Transaction partially signed");

            console.log("🔵 [COLLECTION CREATION] Requesting wallet signature...");
            console.log("🔵 [COLLECTION CREATION] Transaction summary:");
            console.log("🔵 [COLLECTION CREATION] - Instructions count:", transaction.instructions.length);
            console.log("🔵 [COLLECTION CREATION] - Fee payer:", transaction.feePayer?.toString());
            console.log("🔵 [COLLECTION CREATION] - Recent blockhash:", transaction.recentBlockhash);

            let signed_transaction = await wallet.signTransaction(transaction);
            console.log("✅ [COLLECTION CREATION] Transaction signed by wallet successfully");

            console.log("🔵 [COLLECTION CREATION] Serializing transaction...");
            const serializedTransaction = signed_transaction.serialize();
            console.log("✅ [COLLECTION CREATION] Transaction serialized, size:", serializedTransaction.length, "bytes");

            console.log("🔵 [COLLECTION CREATION] Sending transaction to network...");
            var signature = await connection.sendRawTransaction(serializedTransaction, { skipPreflight: true });
            console.log("✅ [COLLECTION CREATION] Transaction sent, signature:", signature);

            if (signature === undefined) {
                console.error("❌ [COLLECTION CREATION] Transaction signature is undefined");
                toast.error("Transaction failed, please try again");
                return;
            }

            signature_ws_id.current = 1;

            if (DEBUG) {
                console.log("🔵 [COLLECTION CREATION] Debug - list signature:", signature);
            }

            console.log("🔵 [COLLECTION CREATION] Setting up signature confirmation listener...");
            connection.onSignature(signature, check_signature_update, "confirmed");
            setTimeout(transaction_failed, 20000);
            console.log("✅ [COLLECTION CREATION] Signature listener and timeout set");
        } catch (error) {
            console.error("❌ [COLLECTION CREATION] Critical error during transaction:", {
                error: error.message,
                stack: error.stack,
                name: error.name,
                cause: error.cause,
                code: error.code,
            });
            setIsLoading(false);
            toast.update(createLaunch, {
                render: "We couldn't create your launch accounts. Error: " + error.message,
                type: "error",
                isLoading: false,
                autoClose: 3000,
            });
            return;
        }
    }, [wallet, newCollectionData, EditCollection, check_signature_update, transaction_failed, uploadFiles]);

    return (
        <form className="mx-auto flex w-full flex-col items-center justify-center bg-[#161616] bg-opacity-75 bg-clip-padding px-6 py-6 shadow-2xl backdrop-blur-sm backdrop-filter md:!w-fit md:rounded-xl md:border-t-[3px] md:border-orange-700 md:px-12 md:py-8 lg:!w-[975px]">
            <Center width="100%" h="100%">
                <VStack w="100%" h="100%">
                    <div className="mb-4 flex flex-col gap-2">
                        <Text className="text-center text-3xl font-semibold text-white lg:text-4xl">Page Information</Text>
                    </div>
                    <VStack className="w-full">
                        <div className={styles.launchBodyUpper}>
                            <div className={styles.launchBodyUpperFields}>
                                <HStack spacing={0} className={styles.eachField}>
                                    <p className="min-w-[120px] text-lg text-white md:min-w-[132px]">Page Name:</p>

                                    <InputGroup style={{ width: lg ? "100%" : "50%", position: "relative" }}>
                                        <InputLeftElement color="white">
                                            <RxSlash size={22} style={{ opacity: 0.5, marginTop: lg ? 0 : 8 }} />
                                        </InputLeftElement>

                                        <Input
                                            pl={8}
                                            bg="#494949"
                                            size={lg ? "md" : "lg"}
                                            required
                                            placeholder="Yourpagename"
                                            className={styles.inputBox}
                                            type="text"
                                            value={name}
                                            onChange={handleNameChange}
                                        />
                                    </InputGroup>
                                </HStack>

                                <HStack spacing={0} mt={sm ? 0 : 3} className={styles.eachField}>
                                    <p className="min-w-[120px] text-lg text-white md:min-w-[132px]">Banner:</p>

                                    <div>
                                        <label className={styles.label}>
                                            <input id="file" type="file" onChange={handleFileChange} />
                                            <span
                                                className="rounded-3xl px-8 py-[0.6rem] font-semibold text-white"
                                                style={{
                                                    background: "linear-gradient(0deg, rgba(254, 106, 0, 1) 0%, rgba(236, 35, 0, 1) 100%)",
                                                    cursor: newCollectionData.current.edit_mode === true ? "not-allowed" : "pointer",
                                                }}
                                            >
                                                Browse
                                            </span>
                                        </label>
                                    </div>

                                    <Text m={0} ml={5} color="white" className="font-face-rk" fontSize={lg ? "medium" : "lg"}>
                                        {newCollectionData.current.banner_file !== null ? banner_name : "No File Selected"}
                                    </Text>
                                </HStack>
                            </div>
                        </div>

                        <VStack w="100%" spacing={30} mt={42} mb={25}>
                            <div className={styles.launchBodyLowerHorizontal}>
                                <div className={styles.eachField}>
                                    <Image width={40} height={40} src="/images/web.png" alt="Website Logo" />
                                    <div className={styles.textLabelInput}>
                                        <input
                                            placeholder="Enter your Website URL"
                                            className={styles.inputBox}
                                            type="text"
                                            value={web}
                                            onChange={(e) => {
                                                setWeb(e.target.value);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.launchBodyLowerHorizontal}>
                                <div className={styles.eachField}>
                                    <Image width={40} height={40} src="/images/tele.png" alt="Telegram" />

                                    <div className={styles.textLabelInput}>
                                        <input
                                            className={styles.inputBox}
                                            placeholder="Enter your Telegram Invite URL"
                                            type="text"
                                            value={telegram}
                                            onChange={(e) => {
                                                setTelegram(e.target.value);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className={styles.launchBodyLowerHorizontal}>
                                <div className={styles.eachField}>
                                    <Image width={40} height={40} src="/images/twt.png" alt="Twitter" />

                                    <div className={styles.textLabelInput}>
                                        <input
                                            required
                                            className={styles.inputBox}
                                            placeholder="Enter your Twitter URL"
                                            type="text"
                                            value={twitter}
                                            onChange={(e) => {
                                                setTwitter(e.target.value);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.launchBodyLowerHorizontal}>
                                <div className={styles.eachField}>
                                    <Image width={40} height={40} src="/images/discord.png" alt="Discord" />

                                    <div className={styles.textLabelInput}>
                                        <input
                                            className={styles.inputBox}
                                            placeholder="Enter your Discord Invite URL"
                                            type="text"
                                            value={discord}
                                            onChange={(e) => {
                                                setDiscord(e.target.value);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </VStack>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 20,
                                marginTop: -1,
                            }}
                        >
                            <Button
                                type="button"
                                size="lg"
                                onClick={(e) => {
                                    setScreen("step 3");
                                }}
                            >
                                Go Back
                            </Button>
                            <Button
                                type="button"
                                size="lg"
                                onClick={(e) => {
                                    if (!isLoading) {
                                        Launch(e);
                                    }
                                }}
                            >
                                {isLoading ? <Spinner /> : "Confirm (4/4)"}
                            </Button>
                        </div>
                    </VStack>
                </VStack>
            </Center>
        </form>
    );
};

export default CollectionPage;
