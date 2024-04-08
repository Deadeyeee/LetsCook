import { VStack, Text, HStack, Progress, Button, Tooltip, Link } from "@chakra-ui/react";
import { bignum_to_num, TokenAccount, request_token_amount } from "../../components/Solana/state";
import { useRef, useEffect, useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/router";
import Image from "next/image";
import useResponsive from "../../hooks/useResponsive";
import UseWalletConnection from "../../hooks/useWallet";
import FeaturedBanner from "../../components/featuredBanner";
import Head from "next/head";
import { MdOutlineContentCopy } from "react-icons/md";
import trimAddress from "../../utils/trimAddress";
import useAppRoot from "../../context/useAppRoot";
import { AssignmentData, CollectionData, LookupData, request_assignment_data } from "../../components/collection/collectionState";
import PageNotFound from "../../components/pageNotFound";
import Loader from "../../components/loader";
import CollectionFeaturedBanner from "../../components/collectionFeaturedBanner";
import useClaimNFT from "../../hooks/collections/useClaimNFT";
import { CollectionKeys, WSS_NODE, RPC_NODE, PROGRAM, Extensions, LaunchFlags, PROD, LaunchKeys } from "../../components/Solana/constants";
import { PublicKey, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import useWrapNFT from "../../hooks/collections/useWrapNFT";
import useMintNFT from "../../hooks/collections/useMintNFT";
import ShowExtensions from "../../components/Solana/extensions";
import {
    unpackMint,
    Mint,
    TOKEN_2022_PROGRAM_ID,
    unpackAccount,
    getTransferFeeConfig,
    getAssociatedTokenAddressSync,
    calculateFee,
} from "@solana/spl-token";
import { getSolscanLink } from "../../utils/getSolscanLink";

function findLaunch(list: CollectionData[], page_name: string | string[]) {
    if (list === null || list === undefined || page_name === undefined || page_name === null) return null;

    let launchList = list.filter(function (item) {
        //console.log(new Date(bignum_to_num(item.launch_date)), new Date(bignum_to_num(item.end_date)))
        return item.page_name == page_name;
    });

    if (launchList.length === 0) return null;

    return launchList[0];
}

const CollectionSwapPage = () => {
    const wallet = useWallet();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { pageName } = router.query;
    const { xs, sm, md, lg } = useResponsive();
    const { handleConnectWallet } = UseWalletConnection();
    const { collectionList, mintData, NFTLookup } = useAppRoot();
    const [launch, setCollectionData] = useState<CollectionData | null>(null);
    const [assigned_nft, setAssignedNFT] = useState<AssignmentData | null>(null);
    const [out_amount, setOutAmount] = useState<number>(0);
    const [nft_balance, setNFTBalance] = useState<number>(0);
    const [token_balance, setTokenBalance] = useState<number>(0);

    const launch_account_ws_id = useRef<number | null>(null);
    const nft_account_ws_id = useRef<number | null>(null);
    const lookup_account_ws_id = useRef<number | null>(null);
    const user_token_ws_id = useRef<number | null>(null);

    const mint_nft = useRef<boolean>(false);
    const check_initial_assignment = useRef<boolean>(true);

    const { ClaimNFT, isLoading: isClaimLoading } = useClaimNFT(launch);
    const { MintNFT, isLoading: isMintLoading } = useMintNFT(launch);
    const { WrapNFT, isLoading: isWrapLoading } = useWrapNFT(launch);

    const check_nft_balance = useCallback(async () => {
        if (launch === null || NFTLookup === null || wallet === null) return;

        console.log("CHECKING NFT BALANCE");
        const connection = new Connection(RPC_NODE, { wsEndpoint: WSS_NODE });

        let CollectionLookup = NFTLookup.current.get(launch.keys[CollectionKeys.CollectionMint].toString());
        let token_addresses: PublicKey[] = [];
        let token_mints: PublicKey[] = [];

        let lookup_keys = CollectionLookup.keys();
        while (true) {
            let lookup_it = lookup_keys.next();
            if (lookup_it.done) break;

            let nft_mint = new PublicKey(lookup_it.value);
            let token_account = getAssociatedTokenAddressSync(
                nft_mint, // mint
                wallet.publicKey, // owner
                true, // allow owner off curve
                TOKEN_2022_PROGRAM_ID,
            );
            token_addresses.push(token_account);
            token_mints.push(nft_mint);
        }

        console.log("have ", token_addresses.length, "addresses to check");

        let token_infos = await connection.getMultipleAccountsInfo(token_addresses, "confirmed");

        let valid_lookups: LookupData[] = [];
        for (let i = 0; i < token_infos.length; i++) {
            if (token_infos[i] === null) {
                continue;
            }
            let account = unpackAccount(token_addresses[i], token_infos[i], TOKEN_2022_PROGRAM_ID);
            if (account.amount > 0) {
                valid_lookups.push(CollectionLookup.get(token_mints[i].toString()));
            }
        }
        console.log("have ", valid_lookups.length, "addresses with balance");

        setNFTBalance(valid_lookups.length);
    }, [NFTLookup, launch, wallet]);

    useEffect(() => {
        if (collectionList === null || mintData === null) return;

        let launch = findLaunch(collectionList, pageName);

        if (launch === null) return;

        setCollectionData(launch);

        let mint = mintData.get(launch.keys[CollectionKeys.MintAddress].toString());
        let transfer_fee_config = getTransferFeeConfig(mint);
        let input_fee = Number(calculateFee(transfer_fee_config.newerTransferFee, BigInt(launch.swap_price)));
        let swap_price = bignum_to_num(launch.swap_price);

        let input_amount = swap_price - input_fee;

        let swap_fee = Math.floor((input_amount * launch.swap_fee) / 100 / 100);

        let output = input_amount - swap_fee;

        let output_fee = Number(calculateFee(transfer_fee_config.newerTransferFee, BigInt(output)));

        let final_output = output - output_fee;

        //console.log("actual input amount was",  input_fee, input_amount,  "fee",  swap_fee,  "output", output, "output fee", output_fee, "final output", final_output);
        setOutAmount(final_output / Math.pow(10, launch.token_decimals));

        if (NFTLookup !== null) {
            check_nft_balance();
        }
    }, [collectionList, pageName, mintData, NFTLookup, check_nft_balance, wallet]);

    // when page unloads unsub from any active websocket listeners

    useEffect(() => {
        return () => {
            console.log("in use effect return");
            const unsub = async () => {
                const connection = new Connection(RPC_NODE, { wsEndpoint: WSS_NODE });
                if (launch_account_ws_id.current !== null) {
                    await connection.removeAccountChangeListener(launch_account_ws_id.current);
                    launch_account_ws_id.current = null;
                }
                if (nft_account_ws_id.current !== null) {
                    await connection.removeAccountChangeListener(nft_account_ws_id.current);
                    nft_account_ws_id.current = null;
                }
            };
            unsub();
        };
    }, []);

    useEffect(() => {
        if (assigned_nft === null || !mint_nft.current) {
            return;
        }

        console.log("CALLING MINT NFT", mint_nft.current);
        MintNFT();

        mint_nft.current = false;
    }, [assigned_nft, MintNFT]);

    const check_launch_update = useCallback(
        async (result: any) => {
            //console.log("collection", result);
            // if we have a subscription field check against ws_id

            let event_data = result.data;

            //console.log("have collection data", event_data, launch_account_ws_id.current);
            let account_data = Buffer.from(event_data, "base64");

            const [updated_data] = CollectionData.struct.deserialize(account_data);
            /*
            for (let i = 0; i < updated_data.availability.length/2; i++) {
                let idx = 1;
                for (let j = 0; j < 8; j++) {
                    console.log(j, (idx & updated_data.availability[i]) > 0);
                    idx *=2
                }
            }

            for (let i = updated_data.availability.length/2; i < updated_data.availability.length; i++) {
                    console.log("left in block", i - updated_data.availability.length/2, updated_data.availability[i]);
                
            }
*/

            if (updated_data.num_available !== launch.num_available) {
                setCollectionData(updated_data);
            }
        },
        [launch],
    );

    const check_assignment_update = useCallback(async (result: any) => {
        //console.log("assignment", result);
        // if we have a subscription field check against ws_id

        let event_data = result.data;

        //console.log("have assignment data", event_data);
        let account_data = Buffer.from(event_data, "base64");

        if (account_data.length === 0) {
            //console.log("account deleted");
            setAssignedNFT(null);
            mint_nft.current = false;
            return;
        }

        const [updated_data] = AssignmentData.struct.deserialize(account_data);

        //console.log(updated_data);
        mint_nft.current = true;
        setAssignedNFT(updated_data);
    }, []);

    const check_program_update = useCallback(
        async (result: any) => {
            //console.log("program data", result);
            // if we have a subscription field check against ws_id

            if (result === undefined) return;

            let event_data = result.accountInfo.data;

            //console.log("have program data", event_data);
            let account_data = Buffer.from(event_data, "base64");

            if (account_data.length === 0) {
                //console.log("account deleted");
                return;
            }
            if (account_data[0] === 10) {
                const [updated_data] = LookupData.struct.deserialize(account_data);
                console.log(updated_data);
                let current_map = NFTLookup.current.get(launch.keys[CollectionKeys.CollectionMint].toString());

                current_map.set(updated_data.nft_mint.toString(), updated_data);

                NFTLookup.current.set(launch.keys[CollectionKeys.CollectionMint].toString(), current_map);
                check_nft_balance();
            }
        },
        [launch, NFTLookup, check_nft_balance],
    );

    const check_user_token_update = useCallback(async (result: any) => {
        //console.log(result);
        // if we have a subscription field check against ws_id

        let event_data = result.data;
        const [token_account] = TokenAccount.struct.deserialize(event_data);
        let amount = bignum_to_num(token_account.amount);
        // console.log("update quote amount", amount);

        setTokenBalance(amount);
    }, []);

    const get_assignment_data = useCallback(async () => {
        if (launch === null) return;

        if (!check_initial_assignment.current) {
            return;
        }

        let user_token_account_key = getAssociatedTokenAddressSync(
            launch.keys[CollectionKeys.MintAddress], // mint
            wallet.publicKey, // owner
            true, // allow owner off curve
            TOKEN_2022_PROGRAM_ID,
        );

        let user_amount = await request_token_amount("", user_token_account_key);
        setTokenBalance(user_amount);

        let nft_assignment_account = PublicKey.findProgramAddressSync(
            [wallet.publicKey.toBytes(), launch.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("assignment")],
            PROGRAM,
        )[0];

        let assignment_data = await request_assignment_data(nft_assignment_account);
        check_initial_assignment.current = false;
        if (assignment_data === null) {
            return;
        }

        console.log(assignment_data);
        setAssignedNFT(assignment_data);
    }, [launch, wallet]);

    useEffect(() => {
        if (launch === null) return;

        const connection = new Connection(RPC_NODE, { wsEndpoint: WSS_NODE });

        if (launch_account_ws_id.current === null) {
            console.log("subscribe 1");
            let launch_data_account = PublicKey.findProgramAddressSync(
                [Buffer.from(launch.page_name), Buffer.from("Collection")],
                PROGRAM,
            )[0];

            launch_account_ws_id.current = connection.onAccountChange(launch_data_account, check_launch_update, "confirmed");
        }

        if (lookup_account_ws_id.current === null) {
            lookup_account_ws_id.current = connection.onProgramAccountChange(PROGRAM, check_program_update, "confirmed");
        }

        if (wallet === null || wallet.publicKey === null) {
            return;
        }
        if (nft_account_ws_id.current === null) {
            console.log("subscribe 2");
            let nft_assignment_account = PublicKey.findProgramAddressSync(
                [wallet.publicKey.toBytes(), launch.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("assignment")],
                PROGRAM,
            )[0];
            nft_account_ws_id.current = connection.onAccountChange(nft_assignment_account, check_assignment_update, "confirmed");
        }

        if (user_token_ws_id.current === null) {
            let user_token_account_key = getAssociatedTokenAddressSync(
                launch.keys[CollectionKeys.MintAddress], // mint
                wallet.publicKey, // owner
                true, // allow owner off curve
                TOKEN_2022_PROGRAM_ID,
            );
            user_token_ws_id.current = connection.onAccountChange(user_token_account_key, check_user_token_update, "confirmed");
        }
    }, [wallet, launch, check_launch_update, check_assignment_update, check_program_update, check_user_token_update]);

    useEffect(() => {
        if (launch === null) return;

        if (wallet === null || wallet.publicKey === null) {
            return;
        }
        console.log("get initial assignment data");
        get_assignment_data();
    }, [launch, wallet, get_assignment_data]);

    if (!pageName) return;

    if (launch === null) return <Loader />;

    if (!launch) return <PageNotFound />;

    const enoughTokenBalance = token_balance >= bignum_to_num(launch.swap_price);

    return (
        <>
            <Head>
                <title>Let&apos;s Cook | {pageName}</title>
            </Head>
            <main style={{ background: "linear-gradient(180deg, #292929 10%, #0B0B0B 100%)" }}>
                <CollectionFeaturedBanner featuredLaunch={launch} isHomePage={false} />
                <div style={{ padding: "16px" }}>
                    <VStack
                        p={md ? 22 : 50}
                        bg="rgba(225, 225, 225, 0.20)"
                        borderRadius={12}
                        border="1px solid white"
                        h="fit-content"
                        justifyContent="space-between"
                    >
                        <Text m={0} align="start" className="font-face-kg" color={"white"} fontSize="xx-large">
                            Hybrid Wrap
                        </Text>
                        <HStack spacing={24} alignItems="start">
                            <VStack>
                                <Image
                                    src={launch.token_icon_url}
                                    width={180}
                                    height={180}
                                    alt="Image Frame"
                                    style={{ backgroundSize: "cover", borderRadius: 12 }}
                                />
                                <Text mt={1} mb={0} color="white" fontSize="x-large" fontFamily="ReemKufiRegular">
                                    {launch.token_symbol}
                                </Text>
                                <HStack spacing={2} align="start" justify="start">
                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"large"}>
                                        CA: {trimAddress(launch.keys[CollectionKeys.MintAddress].toString())}
                                    </Text>

                                    <Tooltip label="Copy Contract Address" hasArrow fontSize="large" offset={[0, 10]}>
                                        <div
                                            style={{ cursor: "pointer" }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                navigator.clipboard.writeText(launch.keys[CollectionKeys.MintAddress].toString());
                                            }}
                                        >
                                            <MdOutlineContentCopy color="white" size={lg ? 22 : 22} />
                                        </div>
                                    </Tooltip>

                                    <Tooltip label="View in explorer" hasArrow fontSize="large" offset={[0, 10]}>
                                        <Link href={getSolscanLink(launch, "Token")} target="_blank" onClick={(e) => e.stopPropagation()}>
                                            <Image
                                                src="/images/solscan.png"
                                                width={lg ? 22 : 22}
                                                height={lg ? 22 : 22}
                                                alt="Solscan icon"
                                            />
                                        </Link>
                                    </Tooltip>

                                    <Tooltip label="Rug Check" hasArrow fontSize="large" offset={[0, 10]}>
                                        <Link
                                            href={`https://rugcheck.xyz/tokens/${
                                                launch && launch.keys && launch.keys[CollectionKeys.MintAddress]
                                                    ? launch.keys[CollectionKeys.MintAddress].toString()
                                                    : ""
                                            }`}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Image
                                                src="/images/rugcheck.jpeg"
                                                width={22}
                                                height={22}
                                                alt="Rugcheck icon"
                                                style={{ borderRadius: "100%" }}
                                            />
                                        </Link>
                                    </Tooltip>
                                </HStack>
                                <ShowExtensions extension_flag={launch.token_extensions} />
                                <HStack mt={2}>
                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"} opacity={0.5}>
                                        Token balance:
                                    </Text>
                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"}>
                                        {token_balance / Math.pow(10, launch.token_decimals)}
                                    </Text>
                                </HStack>
                            </VStack>

                            {wallet.connected ? (
                                <VStack spacing={3} margin="auto 0">
                                    {assigned_nft === null ? (
                                        <Tooltip
                                            label="You don't have enough token balance"
                                            hasArrow
                                            offset={[0, 10]}
                                            isDisabled={enoughTokenBalance}
                                        >
                                            <Button
                                                onClick={() => {
                                                    if (!wallet.connected) {
                                                        handleConnectWallet();
                                                    }

                                                    if (wallet.connected && enoughTokenBalance) {
                                                        ClaimNFT();
                                                    }
                                                }}
                                                isDisabled={!enoughTokenBalance || isClaimLoading || isMintLoading || isWrapLoading}
                                            >
                                                {bignum_to_num(launch.swap_price) / Math.pow(10, launch.token_decimals)}{" "}
                                                {launch.token_symbol} = 1 NFT
                                            </Button>
                                        </Tooltip>
                                    ) : (
                                        <Button onClick={() => MintNFT()}>Claim NFT {assigned_nft.nft_index + 1}</Button>
                                    )}
                                    <Tooltip
                                        label={`You don't have ${launch.collection_name} NFTs`}
                                        hasArrow
                                        offset={[0, 10]}
                                        isDisabled={nft_balance > 0 || isClaimLoading || isMintLoading || isWrapLoading}
                                    >
                                        <Button
                                            onClick={() => {
                                                if (wallet.connected) {
                                                    WrapNFT();
                                                } else {
                                                    handleConnectWallet();
                                                }
                                            }}
                                            isDisabled={nft_balance <= 0 || isClaimLoading || isMintLoading || isWrapLoading}
                                        >
                                            1 NFT = {out_amount.toFixed(Math.min(3, launch.token_decimals))} {launch.token_symbol}
                                        </Button>
                                    </Tooltip>
                                </VStack>
                            ) : (
                                <Button margin="auto 0" onClick={() => handleConnectWallet()}>
                                    Connect your wallet
                                </Button>
                            )}

                            <VStack>
                                <Image
                                    src={launch.collection_icon_url}
                                    width={180}
                                    height={180}
                                    alt="Image Frame"
                                    style={{ backgroundSize: "cover", borderRadius: 12 }}
                                />
                                <Text mt={1} mb={0} color="white" fontSize="x-large" fontFamily="ReemKufiRegular">
                                    {launch.collection_name}
                                </Text>
                                <HStack spacing={2} align="start" justify="start">
                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"large"}>
                                        CA: {trimAddress(launch.keys[CollectionKeys.CollectionMint].toString())}
                                    </Text>

                                    <Tooltip label="Copy Contract Address" hasArrow fontSize="large" offset={[0, 10]}>
                                        <div
                                            style={{ cursor: "pointer" }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                navigator.clipboard.writeText(
                                                    launch && launch.keys && launch.keys[CollectionKeys.CollectionMint]
                                                        ? launch.keys[CollectionKeys.CollectionMint].toString()
                                                        : "",
                                                );
                                            }}
                                        >
                                            <MdOutlineContentCopy color="white" size={lg ? 22 : 22} />
                                        </div>
                                    </Tooltip>

                                    <Tooltip label="View in explorer" hasArrow fontSize="large" offset={[0, 10]}>
                                        <Link
                                            href={getSolscanLink(launch, "Collection")}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Image
                                                src="/images/solscan.png"
                                                width={lg ? 22 : 22}
                                                height={lg ? 22 : 22}
                                                alt="Solscan icon"
                                            />
                                        </Link>
                                    </Tooltip>
                                </HStack>
                                <ShowExtensions extension_flag={launch.flags[LaunchFlags.Extensions]} />
                                <HStack mt={2}>
                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"} opacity={0.5}>
                                        NFT balance:
                                    </Text>
                                    <Text m={0} color={"white"} fontFamily="ReemKufiRegular" fontSize={"medium"}>
                                        {nft_balance}
                                    </Text>
                                </HStack>
                            </VStack>
                        </HStack>
                        <VStack spacing={0} w="100%" style={{ position: "relative" }}>
                            <Text color="white" fontSize="x-large" fontFamily="ReemKufiRegular">
                                Available Supply
                            </Text>
                            <HStack w="100%" style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
                                <Progress
                                    w="100%"
                                    h={29}
                                    borderRadius={20}
                                    sx={{
                                        "& > div": {
                                            background: "linear-gradient(180deg, #8DFE7A 0%, #3E9714 100%)",
                                        },
                                    }}
                                    size="sm"
                                    min={0}
                                    max={launch.total_supply}
                                    value={launch.num_available}
                                    boxShadow="0px 5px 15px 0px rgba(0,0,0,0.6) inset"
                                />
                                <HStack style={{ position: "absolute", zIndex: 1 }}>
                                    <HStack justify="center">
                                        <Text m="0" color="black" fontSize={sm ? "medium" : "large"} fontFamily="ReemKufiRegular">
                                            {launch.num_available} / {launch.total_supply}
                                        </Text>
                                    </HStack>
                                </HStack>
                            </HStack>
                        </VStack>
                    </VStack>
                </div>
            </main>
        </>
    );
};

export default CollectionSwapPage;