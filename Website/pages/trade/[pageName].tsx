import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/router";
import Head from "next/head";
import { MintData } from "../../components/Solana/state";
import { MMLaunchData, reward_schedule, AMMData, getAMMPlugins, AMMPluginData } from "../../components/Solana/jupiter_state";
import { bignum_to_num } from "../../components/Solana/state";
import { Config } from "../../components/Solana/constants";
import { useEffect, useState, useRef } from "react";
import { getTransferFeeConfig } from "@solana/spl-token";

import {
    HStack,
    VStack,
    Text,
    Box,
    Tooltip,
    Link,
    Modal,
    ModalBody,
    ModalContent,
    Input,
    ModalOverlay,
    useDisclosure,
} from "@chakra-ui/react";
import useResponsive from "../../hooks/useResponsive";
import Image from "next/image";
import { MdOutlineContentCopy } from "react-icons/md";
import { PiArrowsOutLineVerticalLight } from "react-icons/pi";
import { createChart, CrosshairMode } from "lightweight-charts";
import trimAddress from "../../utils/trimAddress";
import { FaChartLine, FaInfo, FaWallet } from "react-icons/fa";

import MyRewardsTable from "../../components/tables/myRewards";
import Links from "../../components/Buttons/links";
import { HypeVote } from "../../components/hypeVote";
import UseWalletConnection from "../../hooks/useWallet";
import ShowExtensions from "../../components/Solana/extensions";
import { getSolscanLink } from "../../utils/getSolscanLink";
import { IoMdSwap } from "react-icons/io";
import { FaPlusCircle } from "react-icons/fa";
import styles from "../../styles/Launch.module.css";

import RemoveLiquidityPanel from "../../components/tradePanels/removeLiquidityPanel";
import AddLiquidityPanel from "../../components/tradePanels/addLiquidityPanel";
import SellPanel from "../../components/tradePanels/sellPanel";
import BuyPanel from "../../components/tradePanels/buyPanel";
import formatPrice from "../../utils/formatPrice";
import Loader from "../../components/loader";
import useAddTradeRewards from "../../hooks/cookAMM/useAddTradeRewards";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import useAMM from "@/hooks/data/useAMM";
import useTokenBalance from "@/hooks/data/useTokenBalance";
import { useSOLPrice } from "@/hooks/data/useSOLPrice";
import useListing from "@/hooks/data/useListing";
import useGetUserBalance from "@/hooks/data/useGetUserBalance";
import { ListingData } from "@letscook/sdk/dist/state/listing";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import useSwapRaydium from "@/hooks/raydium/useSwapRaydium";
import useSwapRaydiumClassic from "@/hooks/raydium/useSwapRaydiumClassic";
import { CalculateChunkedOutput } from "@/utils/calculateChunkedOutput";
import { getBaseOutput, getQuoteOutput } from "@/utils/getBaseQuoteOutput";
import { IoSwapVertical } from "react-icons/io5";
import { ChevronDown, Loader2 } from "lucide-react";
import usePerformSwap from "@/hooks/jupiter/usePerformSwap";

const TradePage = () => {
    const wallet = useWallet();
    const { handleConnectWallet } = UseWalletConnection();
    const router = useRouter();

    const { xs, sm, lg } = useResponsive();

    const { SOLPrice } = useSOLPrice();

    const { userBalance: userSOLBalance } = useGetUserBalance();
    const [panel, setPanel] = useState("Trade");
    const [isAddLiquidity, setIsAddLiquidity] = useState(true);

    const { pageName } = router.query;

    const [leftPanel, setLeftPanel] = useState("Info");

    const [additionalPixels, setAdditionalPixels] = useState(0);

    const [mobilePageContent, setMobilePageContent] = useState("Chart");
    const [tokenAmount, setTokenAmount] = useState<number>(0);
    const [solAmount, setSOLAmount] = useState<number>(0);

    const {
        amm,
        ammPlugins,
        baseMint,
        quoteMint,
        lpMint,
        baseTokenAccount: ammBaseAddress,
        quoteTokenAccount: ammQuoteAddress,
        baseTokenBalance: ammBaseAmount,
        quoteTokenBalance: ammQuoteAmount,
        lpAmount: ammLPAmount,
        marketData,
        lastDayVolume,
        currentRewards,
        error: ammError,
    } = useAMM({ pageName: pageName as string | null });

    const { listing, error: listingError } = useListing({ tokenMintAddress: baseMint?.mint.address });

    const { tokenBalance: userBaseAmount } = useTokenBalance({ mintData: baseMint });
    const { tokenBalance: userQuoteAmount } = useTokenBalance({ mintData: quoteMint });
    const { tokenBalance: userLPAmount } = useTokenBalance({ mintData: lpMint });

    const handleMouseDown = () => {
        document.addEventListener("mousemove", handleMouseMove);

        document.addEventListener("mouseup", () => {
            document.removeEventListener("mousemove", handleMouseMove);
        });
    };

    const handleMouseMove = (event) => {
        setAdditionalPixels((prevPixels) => prevPixels + event.movementY);
    };

    if (listing === null || amm === null || !baseMint) {
        return <Loader />;
    }

    return (
        <>
            <Head>
                <title>Let&apos;s Cook | Trade</title>
            </Head>
            <main className="md:p-8">
                <HStack className="gap-2" align="start" pb={sm ? 14 : 0}>
                    {(!sm || (sm && (mobilePageContent === "Info" || mobilePageContent === "Trade"))) && (
                        <VStack
                            align="start"
                            w={sm ? "100%" : 320}
                            className="min-w-[375px] rounded-xl border-t-[3px] border-orange-700 bg-[#161616] bg-opacity-75 bg-clip-padding shadow-2xl backdrop-blur-sm backdrop-filter"
                            gap={0}
                        >
                            <HStack
                                spacing={5}
                                w="100%"
                                px={5}
                                pb={sm ? 5 : 0}
                                style={{ borderBottom: sm ? "0.5px solid rgba(134, 142, 150, 0.5)" : "" }}
                                className="py-4"
                            >
                                <Image
                                    alt="Launch icon"
                                    src={baseMint.icon}
                                    width={65}
                                    height={65}
                                    style={{ borderRadius: "8px", backgroundSize: "cover" }}
                                />
                                <VStack align="start" spacing={1}>
                                    <p className="text-xl text-white">{baseMint.symbol}</p>
                                    <HStack spacing={3} align="start" justify="start">
                                        <p className="text-lg text-white">{trimAddress(baseMint.mint.address.toString())}</p>

                                        {/* <Tooltip label="Copy Contract Address" hasArrow fontSize="large" offset={[0, 10]}> */}
                                        <div
                                            style={{ cursor: "pointer" }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                navigator.clipboard.writeText(baseMint.mint.address.toString());
                                            }}
                                        >
                                            <MdOutlineContentCopy color="white" size={25} />
                                        </div>
                                        {/* </Tooltip> */}

                                        {/* <Tooltip label="View in explorer" hasArrow fontSize="large" offset={[0, 10]}> */}
                                        <Link
                                            href={getSolscanLink(baseMint.mint.address, "Token")}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Image src="/images/solscan.png" width={25} height={25} alt="Solscan icon" />
                                        </Link>
                                        {/* </Tooltip> */}
                                    </HStack>
                                </VStack>
                            </HStack>

                            <div className="flex justify-center w-full">
                                {["Trade", "Liquidity", "Info"].map((name, i) => {
                                    const isActive = panel === name;

                                    return (
                                        <Button
                                            key={name}
                                            className={`text-md px-6 text-white ${isActive ? "" : "text-opacity-75"} hover:text-black`}
                                            variant={isActive ? "default" : "ghost"}
                                            onClick={() => {
                                                setPanel(name);
                                            }}
                                        >
                                            {name}
                                        </Button>
                                    );
                                })}
                            </div>

                            {panel === "Trade" && (
                                <BuyAndSell
                                    amm={amm}
                                    base_mint={baseMint}
                                    base_balance={ammBaseAmount}
                                    quote_balance={ammQuoteAmount}
                                    amm_lp_balance={ammLPAmount}
                                    user_base_balance={userBaseAmount}
                                    user_lp_balance={userLPAmount}
                                    userSOLBalance={userSOLBalance}
                                />
                            )}

                            {panel === "Liquidity" ? (
                                isAddLiquidity ? (
                                    <div className="w-full mt-4">
                                        <AddLiquidityPanel
                                            amm={amm}
                                            base_mint={baseMint}
                                            user_base_balance={userBaseAmount}
                                            user_quote_balance={userSOLBalance}
                                            sol_amount={solAmount}
                                            token_amount={tokenAmount}
                                            connected={wallet.connected}
                                            setSOLAmount={setSOLAmount}
                                            setTokenAmount={setTokenAmount}
                                            handleConnectWallet={handleConnectWallet}
                                            amm_base_balance={ammBaseAmount}
                                            amm_quote_balance={ammQuoteAmount}
                                            amm_lp_balance={ammLPAmount}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full mt-4">
                                        <RemoveLiquidityPanel
                                            amm={amm}
                                            base_mint={baseMint}
                                            user_base_balance={userBaseAmount}
                                            user_quote_balance={userSOLBalance}
                                            user_lp_balance={userLPAmount}
                                            sol_amount={solAmount}
                                            token_amount={tokenAmount}
                                            connected={wallet.connected}
                                            setSOLAmount={setSOLAmount}
                                            setTokenAmount={setTokenAmount}
                                            handleConnectWallet={handleConnectWallet}
                                            amm_base_balance={ammBaseAmount}
                                            amm_quote_balance={ammQuoteAmount}
                                            amm_lp_balance={ammLPAmount}
                                        />
                                    </div>
                                )
                            ) : null}

                            {panel === "Info" && (
                                <InfoContent
                                    listing={listing}
                                    amm={amm}
                                    base_mint={baseMint}
                                    volume={lastDayVolume}
                                    mm_data={currentRewards}
                                    price={marketData && marketData.length > 0 ? marketData[marketData.length - 1].close : 0}
                                    sol_price={SOLPrice}
                                    quote_amount={ammQuoteAmount}
                                    lpMint={lpMint}
                                    lpTotal={ammLPAmount}
                                />
                            )}
                        </VStack>
                    )}

                    {(!sm || (sm && mobilePageContent === "Chart")) && (
                        <VStack
                            align="start"
                            justify="start"
                            w="100%"
                            spacing={1}
                            style={{
                                minHeight: "100vh",
                                overflow: "auto",
                            }}
                        >
                            {/* <div className="w-full overflow-auto rounded-lg bg-[#161616] bg-opacity-75 bg-clip-padding p-3 shadow-2xl backdrop-blur-sm backdrop-filter"> */}
                            <ChartComponent data={marketData} additionalPixels={additionalPixels} />
                            {/* </div> */}
                            <div
                                style={{
                                    width: "100%",
                                    height: "0px",
                                    cursor: "ns-resize",
                                    position: "relative",
                                }}
                                onMouseDown={handleMouseDown}
                            >
                                <PiArrowsOutLineVerticalLight
                                    size={26}
                                    style={{
                                        position: "absolute",
                                        color: "white",
                                        margin: "auto",
                                        top: 0,
                                        left: 0,
                                        bottom: 0,
                                        right: 0,
                                        opacity: 0.75,
                                        zIndex: 99,
                                    }}
                                />
                            </div>

                            <div className="w-full -mt-4">
                                <MyRewardsTable amm={amm} />
                            </div>
                        </VStack>
                    )}
                </HStack>

                {sm && (
                    <HStack
                        bg="url(/images/footer_fill.jpeg)"
                        bgSize="cover"
                        boxShadow="0px 3px 13px 13px rgba(0, 0, 0, 0.55)"
                        position="fixed"
                        bottom={0}
                        h={16}
                        w="100%"
                        gap={2}
                        justify="space-around"
                    >
                        <VStack
                            spacing={0.5}
                            w="120px"
                            onClick={() => {
                                setMobilePageContent("Chart");
                            }}
                        >
                            <FaChartLine size={24} color={"#683309"} />
                            <Text mb={0} color={"#683309"} fontSize="medium" fontWeight="bold">
                                Chart
                            </Text>
                        </VStack>

                        <VStack
                            w="120px"
                            onClick={() => {
                                setMobilePageContent("Trade");
                                setPanel("Trade");
                            }}
                        >
                            <IoMdSwap size={28} color={"#683309"} />
                            <Text mb={0} color={"#683309"} fontSize="medium" fontWeight="bold">
                                Buy/Sell
                            </Text>
                        </VStack>

                        <VStack
                            w="120px"
                            onClick={() => {
                                setMobilePageContent("Info");
                                setPanel("Info");
                            }}
                        >
                            <FaInfo size={24} color={"#683309"} />
                            <Text mb={0} color={"#683309"} fontSize="medium" fontWeight="bold">
                                Info
                            </Text>
                        </VStack>
                    </HStack>
                )}
            </main>
        </>
    );
};

const AddRewardModal = ({ amm, isOpen, onClose }: { amm: AMMData; isOpen: boolean; onClose: () => void }) => {
    const { xs, lg } = useResponsive();
    const [quantity, setQuantity] = useState<string>("");
    const { AddTradeRewards } = useAddTradeRewards();

    const handleSubmit = (e) => {
        let value = parseInt(quantity);
        if (isNaN(value)) {
            toast.error("Invalid quantity");
            return;
        }
        if (!amm) {
            toast.error("Waiting for AMM Data");
            return;
        }
        AddTradeRewards(amm.base_mint.toString(), amm.quote_mint.toString(), value);
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} isCentered>
                <ModalOverlay />
                <ModalContent
                    bg="url(/images/square-frame.png)"
                    bgSize="contain"
                    bgRepeat="no-repeat"
                    h={345}
                    py={xs ? 6 : 12}
                    px={xs ? 8 : 10}
                >
                    <ModalBody>
                        <VStack align="start" justify={"center"} h="100%" spacing={0} mt={xs ? -8 : 0}>
                            <Text className="font-face-kg" color="white" fontSize="x-large">
                                Total Rewards
                            </Text>
                            <Input
                                placeholder={"Enter Total Reward Quantity"}
                                size={lg ? "md" : "lg"}
                                maxLength={25}
                                required
                                type="text"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                color="white"
                            />
                            <HStack mt={xs ? 6 : 10} justify="end" align="end" w="100%">
                                <Text
                                    mr={3}
                                    align="end"
                                    fontSize={"medium"}
                                    style={{
                                        fontFamily: "KGSummerSunshineBlackout",
                                        color: "#fc3838",
                                        cursor: "pointer",
                                    }}
                                    onClick={onClose}
                                >
                                    GO BACK
                                </Text>
                                <button
                                    type="button"
                                    onClick={async (e) => {
                                        handleSubmit(e);
                                    }}
                                    className={`${styles.nextBtn} font-face-kg`}
                                >
                                    Add
                                </button>
                            </HStack>
                        </VStack>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
};

const BuyAndSell = ({
    amm,
    base_mint,
    base_balance,
    quote_balance,
    amm_lp_balance,
    user_base_balance,
    user_lp_balance,
    userSOLBalance,
}: {
    amm: AMMData;
    base_mint: MintData;
    base_balance: number;
    quote_balance: number;
    amm_lp_balance: number;
    user_base_balance: number;
    user_lp_balance: number;
    userSOLBalance: number;
}) => {
    const [isBuy, setIsBuy] = useState(true);
    const [isTxnDetailOpen, setIsTxnDetailOpen] = useState(false);
    const { xs } = useResponsive();
    const wallet = useWallet();
    const { handleConnectWallet } = UseWalletConnection();
    const [selected, setSelected] = useState("Buy");
    const [tokenAmount, setTokenAmount] = useState<number>(0);
    const [solAmount, setSOLAmount] = useState<number>(0);
    // const [token_amount, setTokenAmount] = useState<number>(0);
    // const [sol_amount, setSOLAmount] = useState<number>(0);
    const { PerformSwap:PlaceMarketOrder, isLoading: placingOrder } = usePerformSwap(amm);
    const { SwapRaydium, isLoading: placingRaydiumOrder } = useSwapRaydium(amm);
    const { SwapRaydiumClassic, isLoading: placingRaydiumClassicOrder } = useSwapRaydiumClassic(amm);

    const isLoading = placingOrder || placingRaydiumOrder || placingRaydiumClassicOrder;
    base_balance = parseFloat(base_balance.toString().replace('.', ''));
    console.log(base_balance)
    // Early return if required props are missing
    if (!base_mint || !amm) {
        return null;
    }

    const baseDecimals = base_mint.mint.decimals;
    const baseRaw = Math.floor(tokenAmount * Math.pow(10, baseDecimals));
    const quoteRaw = Math.floor(solAmount * Math.pow(10, 9));

    const plugins: AMMPluginData = getAMMPlugins(amm);

    const calculateOutputs = () => {
        const base_output = plugins.liquidity_active
            ? CalculateChunkedOutput(quoteRaw, quote_balance, base_balance, amm.fee, plugins, baseDecimals)
            : getBaseOutput(quoteRaw, base_balance, quote_balance, amm.fee, baseDecimals);

        const quote_output = plugins.liquidity_active
            ? CalculateChunkedOutput(baseRaw, quote_balance, base_balance, amm.fee, plugins, 9, baseDecimals)
            : getQuoteOutput(baseRaw, base_balance, quote_balance, amm.fee, 9, baseDecimals);

        const base_rate = plugins.liquidity_active
            ? CalculateChunkedOutput(1e9, quote_balance, base_balance, 0, plugins, baseDecimals)
            : getBaseOutput(1e9, base_balance, quote_balance, 0, baseDecimals);

        const quote_rate = plugins.liquidity_active
            ? CalculateChunkedOutput(1 * Math.pow(10, baseDecimals), quote_balance, base_balance, 0, plugins, 9, baseDecimals)
            : getQuoteOutput(1 * Math.pow(10, baseDecimals), base_balance, quote_balance, 0, 9, baseDecimals);

        return { base_output, quote_output, base_rate, quote_rate };
    };

    const { base_output, quote_output, base_rate, quote_rate } = calculateOutputs();

    const formatOutputString = (output: number[], decimals: number) => {
        console.log(decimals, "decimals")
        const outputString = formatPrice(output[0], decimals);
        const slippage = output[1] / output[0] - 1;
        const slippageString = isNaN(slippage) ? "0" : (slippage * 100).toFixed(2);
        return {
            outputString: outputString === "NaN" ? "0" : outputString,
            slippageString,
            fullString: slippage > 0 ? `${outputString} (${slippageString}%)` : outputString,
        };
    };

    const base_output_formatted = formatOutputString(base_output, baseDecimals);
    const quote_output_formatted = formatOutputString(quote_output, 5);

    const handleAmountChange = (value: string) => {
        const parsedValue = parseFloat(value);
        const isValidNumber = !isNaN(parsedValue) || value === "";
        const newValue = isValidNumber ? parsedValue : 0;

        setSOLAmount(newValue);
        setTokenAmount(newValue);
    };

    const handleSwap = async () => {
        if (!wallet.connected) {
            handleConnectWallet();
            return;
        }

        const solAmount_raw = solAmount * Math.pow(10, 9);
        const tokenAmount_raw = tokenAmount * Math.pow(10, baseDecimals);

        try {
            if (isBuy) {
                switch (amm.provider) {
                    case 0:
                        await PlaceMarketOrder(tokenAmount, solAmount, 0);
                        break;
                    case 1:
                        await SwapRaydium(base_output[0] * Math.pow(10, baseDecimals), 2 * solAmount_raw, 0);
                        break;
                    case 2:
                        await SwapRaydiumClassic(base_output[0] * Math.pow(10, baseDecimals), solAmount_raw, 0);
                        break;
                }
            } else {
                switch (amm.provider) {
                    case 0:
                        await PlaceMarketOrder(tokenAmount, solAmount, 1);
                        break;
                    case 1:
                        await SwapRaydium(tokenAmount_raw, 0, 1);
                        break;
                    case 2:
                        await SwapRaydiumClassic(tokenAmount_raw, 0, 1);
                        break;
                }
            }
        } catch (error) {
            console.error("Swap failed:", error);
        }
    };

    const transfer_fee_config = getTransferFeeConfig(base_mint.mint);
    const transfer_fee = transfer_fee_config?.newerTransferFee.transferFeeBasisPoints ?? 0;
    const max_transfer_fee = transfer_fee_config ? Number(transfer_fee_config.newerTransferFee.maximumFee) / Math.pow(10, baseDecimals) : 0;

    const AMMfee = (amm.fee * 0.001).toFixed(3);
    return (
        <div className="w-full px-4 my-4 text-white">
            <div className="flex flex-col gap-2">
                {/* Input Fields */}
                <div>
                    {/* From Token Input */}
                    <div>
                        <div className="flex items-center justify-between mb-2 opacity-50">
                            <div>You're Paying</div>
                            <div className="flex items-center gap-1">
                                <FaWallet size={12} />
                                <p className="text-sm">
                                    {isBuy
                                        ? userSOLBalance.toFixed(5)
                                        : (user_base_balance).toLocaleString("en-US", {
                                              minimumFractionDigits: 2,
                                          })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-xl">
                            <div className="flex items-center gap-2 rounded-lg bg-gray-700 px-2.5 py-1.5">
                                <div className="w-6">
                                    <Image
                                        src={isBuy ? Config.token_image : base_mint.icon}
                                        width={25}
                                        height={25}
                                        alt="Token Icon"
                                        className="rounded-full"
                                    />
                                </div>
                                <span className="text-nowrap">{isBuy ? Config.token : base_mint.name}</span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                placeholder="0"
                                className="w-full text-right bg-transparent focus:outline-none"
                                value={isBuy ? solAmount : tokenAmount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Swap Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={() => setIsBuy(!isBuy)}
                            className="z-50 p-2 mx-auto mt-2 -mb-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700"
                        >
                            <IoSwapVertical size={18} className="opacity-75" />
                        </button>
                    </div>

                    {/* To Token Input */}
                    <div className="">
                        <div className="flex items-center justify-between mb-2 opacity-50">
                            <div>To Receive</div>
                            <div className="flex items-center gap-1">
                                <FaWallet size={12} />
                                <p className="text-sm">
                                    {!isBuy
                                        ? userSOLBalance.toFixed(5)
                                        : (user_base_balance).toLocaleString("en-US", {
                                              minimumFractionDigits: 2,
                                          })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-xl">
                            <div className="flex items-center gap-2 rounded-lg bg-gray-700 px-2.5 py-1.5">
                                <div className="w-6">
                                    <Image
                                        src={!isBuy ? Config.token_image : base_mint.icon}
                                        width={25}
                                        height={25}
                                        alt="Token Icon"
                                        className="rounded-full"
                                    />
                                </div>
                                <span className="text-nowrap">{!isBuy ? Config.token : base_mint.name}</span>
                            </div>
                            <input
                                readOnly
                                disabled
                                type="text"
                                className="w-full text-right bg-transparent opacity-50 cursor-not-allowed focus:outline-none"
                                value={isBuy ? base_output_formatted.fullString : quote_output_formatted.fullString}
                            />
                        </div>
                    </div>
                </div>

                {/* Transaction Details */}
                <div className="flex flex-col w-full max-w-md my-2 rounded-lg bg-white/5">
                    <button
                        onClick={() => setIsTxnDetailOpen(!isTxnDetailOpen)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-[0.6rem] text-white transition-colors hover:bg-white/10"
                    >
                        <span>Transaction Details</span>
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isTxnDetailOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isTxnDetailOpen && (
                        <div className="flex flex-col gap-3 px-3 py-3 text-white text-opacity-50 rounded-md">
                            <HStack w="100%" justify="space-between">
                                <p className="text-md">Rate</p>
                                <p className="text-right">
                                    {isBuy
                                        ? `1 ${Config.token} = ${formatPrice(base_rate[0], baseDecimals)} ${base_mint.symbol}`
                                        : `1 ${base_mint.symbol} = ${formatPrice(quote_rate[0], 5)} ${Config.token}`}
                                </p>
                            </HStack>

                            <HStack w="100%" justify="space-between">
                                <p className="text-md">Liquidity Provider Fee</p>
                                <p>{AMMfee}%</p>
                            </HStack>

                            <HStack w="100%" justify="space-between">
                                <p className="text-md">Slippage</p>
                                <p>{isBuy ? base_output_formatted.slippageString : quote_output_formatted.slippageString}%</p>
                            </HStack>

                            {max_transfer_fee > 0 && (
                                <>
                                    <div className="w-full h-1 border-b border-gray-600/50"></div>
                                    <HStack w="100%" justify="space-between">
                                        <p className="text-md">Transfer Fee</p>
                                        <p>{transfer_fee / 100}%</p>
                                    </HStack>
                                    <HStack w="100%" justify="space-between">
                                        <p className="text-md">Max Transfer Fee</p>
                                        <p>
                                            {max_transfer_fee} {base_mint.symbol}
                                        </p>
                                    </HStack>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Swap Button */}
                <button
                    className={`w-full rounded-xl py-3 text-lg font-semibold text-black hover:bg-opacity-90 ${
                        !wallet.connected ? "bg-white" : isBuy ? "bg-[#83FF81]" : "bg-[#FF6E6E]"
                    }`}
                    onClick={handleSwap}
                    disabled={isLoading}
                >
                    {!wallet.connected ? "Connect Wallet" : isLoading ? <Loader2 className="mx-auto animate-spin" /> : "Swap"}
                </button>
            </div>
        </div>
    );
};

const InfoContent = ({
    listing,
    amm,
    base_mint,
    price,
    sol_price,
    quote_amount,
    volume,
    mm_data,
    lpMint,
    lpTotal,
}: {
    listing: ListingData;
    amm: AMMData;
    base_mint: MintData;
    price: number;
    sol_price: number;
    quote_amount: number;
    volume: number;
    mm_data: MMLaunchData | null;
    lpMint: MintData;
    lpTotal: number;
}) => {
    const { isOpen: isRewardsOpen, onOpen: onRewardsOpen, onClose: onRewardsClose } = useDisclosure();

    let current_date = Math.floor((new Date().getTime() / 1000 - bignum_to_num(amm.start_time)) / 24 / 60 / 60);
    let reward = reward_schedule(current_date, amm, base_mint);
    if (mm_data !== null && mm_data !== undefined) {
        reward = bignum_to_num(mm_data.token_rewards) / Math.pow(10, base_mint.mint.decimals);
    }

    let total_supply = Number(base_mint.mint.supply) / Math.pow(10, base_mint.mint.decimals);
    let market_cap = total_supply * price * sol_price;

    let liquidity = Math.min(market_cap, 2 * quote_amount * sol_price);

    const PRECISION = BigInt(10 ** 9);
    const scaled_lp_supply = (BigInt(lpMint.mint.supply.toString()) * PRECISION) / BigInt(Math.pow(10, lpMint.mint.decimals));
    let lp_supply = Number(scaled_lp_supply) / Number(PRECISION);
    let lp_total = lpTotal / Math.pow(10, lpMint.mint.decimals);
    let tlv = (liquidity * (lp_total - lp_supply)) / lp_total;
    console.log(lpMint.mint.address.toString());
    let market_cap_string =
        sol_price === 0
            ? "--"
            : market_cap.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              });

    let liquidity_string =
        sol_price === 0
            ? "--"
            : liquidity.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              });

    let tlv_string =
        sol_price === 0
            ? "--"
            : tlv.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              });

    return (
        <>
            <div className="flex flex-col w-full mt-2 space-y-0">
                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">Pool:</span>
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-md">{amm.provider === 0 ? "Let's Cook" : "Raydium"}</span>
                        {amm.provider === 0 && <Image src="/favicon.ico" alt="Cook Icon" width={30} height={30} />}
                        {amm.provider === 1 && <Image src="/images/raydium.png" alt="Raydium Icon" width={30} height={30} />}
                    </div>
                </div>

                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">Price:</span>
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-md">{formatPrice(price, 5)}</span>
                        <Image src={Config.token_image} width={30} height={30} alt="SOL Icon" />
                    </div>
                </div>

                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">Volume (24h):</span>
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-md">{volume ? volume.toLocaleString() : 0}</span>
                        <Image src={Config.token_image} width={30} height={30} alt="Token Icon" />
                    </div>
                </div>

                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">Market Making Volume:</span>
                    <span className="text-white text-md">
                        {mm_data ? (bignum_to_num(mm_data.buy_amount) / Math.pow(10, base_mint.mint.decimals)).toLocaleString() : 0}
                    </span>
                </div>

                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-opacity-50 text-md text-">Market Making Rewards:</span>
                        {reward === 0 && (
                            <span className="text-white text-opacity-50 text-md text-">
                                <FaPlusCircle onClick={() => onRewardsOpen()} />
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-md">{reward.toLocaleString()}</span>
                        <Image src={base_mint.icon} width={30} height={30} alt="Token Icon" />
                    </div>
                </div>

                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">Token Supply:</span>
                    <span className="text-white text-md">{total_supply.toLocaleString()}</span>
                </div>
                {/*<div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">Market Cap:</span>
                    <span className="text-white text-md">${market_cap_string}</span>
                </div>*/}

                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">Liquidity:</span>
                    <span className="text-white text-md">${liquidity_string}</span>
                </div>

                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">TVL:</span>
                    <span className="text-white text-md">${tlv_string}</span>
                </div>

                <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                    <span className="text-white text-opacity-50 text-md text-">Hype:</span>
                    <HypeVote
                        launch_type={0}
                        launch_id={bignum_to_num(listing.id)}
                        page_name={""}
                        positive_votes={listing.positive_votes}
                        negative_votes={listing.negative_votes}
                        isTradePage={true}
                        tokenMint={listing.mint.toString()}
                    />
                </div>

                {/* Extensions */}
                {base_mint.extensions !== 0 && (
                    <div className="flex justify-between w-full px-4 py-3 border-b border-gray-600/50">
                        <span className="text-white text-opacity-50 text-md text-">Extensions:</span>
                        <ShowExtensions extension_flag={base_mint.extensions} />
                    </div>
                )}
                
                {/* Socials */}
                <div className="flex justify-between w-full px-4 py-3">
                    <span className="text-white text-opacity-50 text-md text-">Socials:</span>
                    <Links socials={listing.socials} isTradePage={true} />
                </div>
            </div>
            <AddRewardModal amm={amm} isOpen={isRewardsOpen} onClose={onRewardsClose} />
        </>
    );
};

const ChartComponent = (props) => {
    const { data, additionalPixels } = props;

    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);

    useEffect(() => {
        if (!data) return;

        const handleResize = () => {
            if (chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        if (chartContainerRef.current) {
            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: { color: "#171B26" },
                    textColor: "#DDD",
                },
                grid: {
                    vertLines: { color: "#242733" },
                    horzLines: { color: "#242733" },
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                },
                crosshair: {
                    mode: CrosshairMode.Normal,
                },
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
            });

            chartRef.current = chart;

            const series = chart.addCandlestickSeries({
                upColor: "#00C38C",
                downColor: "#F94D5C",
                borderVisible: false,
                wickUpColor: "#00C38C",
                wickDownColor: "#F94D5C",
                priceFormat: {
                    type: "custom",
                    formatter: (price) => price.toExponential(2),
                    minMove: 0.000000001,
                },
            });

            seriesRef.current = series;
            series.setData(data);

            chart.timeScale().fitContent();

            window.addEventListener("resize", handleResize);

            return () => {
                window.removeEventListener("resize", handleResize);
                chart.remove();
            };
        }
    }, [data]);

    useEffect(() => {
        if (seriesRef.current) {
            seriesRef.current.setData(data);
        }
    }, [data]);

    useEffect(() => {
        if (chartContainerRef.current && chartRef.current) {
            const newHeight = `calc(60vh + ${additionalPixels}px)`;
            chartContainerRef.current.style.height = newHeight;
            chartRef.current.applyOptions({
                height: chartContainerRef.current.clientHeight,
            });
        }
    }, [additionalPixels]);

    return (
        <HStack
            ref={chartContainerRef}
            className="rounded-xl"
            justify="center"
            id="chartContainer"
            w="100%"
            h={`calc(60vh + ${additionalPixels}px)`}
            style={{
                overflow: "auto",
                position: "relative",
            }}
            spacing={0}
        />
    );
};

export default TradePage;
