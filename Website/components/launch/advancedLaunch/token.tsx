import { Dispatch, SetStateAction, MutableRefObject, useState, MouseEventHandler, useRef, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";
import { useMediaQuery } from "react-responsive";
import {
    Center,
    VStack,
    Text,
    HStack,
    Input,
    InputRightElement,
    InputGroup,
    InputLeftElement,
    Spacer,
    Box,
    Checkbox,
    Tooltip,
    Divider,
    chakra,
    FormControl,
    FormLabel,
    Spinner,
    RadioGroup,
    Stack,
    Radio,
    useDisclosure,
    Modal,
    ModalBody,
    ModalContent,
    ModalOverlay,
} from "@chakra-ui/react";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
    
    Distribution,
    uInt32ToLEBytes,
    getLaunchType,
    getLaunchTypeIndex,
} from "../../Solana/state";
import Image from "next/image";
import styles from "../../../styles/Launch.module.css";
import WoodenButton from "../../Buttons/woodenButton";
import useResponsive from "../../../hooks/useResponsive";
import { useRouter } from "next/router";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import useAppRoot from "../../../context/useAppRoot";
import { toast } from "react-toastify";
import { FaDollarSign } from "react-icons/fa";
import getImageDimensions from "../../../utils/getImageDimension";
import { distributionLabels } from "../../../constant/root";
import trimAddress from "../../../utils/trimAddress";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Config } from "../../Solana/constants";
import { Button } from "@/components/ui/button";
interface TokenPageProps {
    setScreen: Dispatch<SetStateAction<string>>;
}

const TokenPage = ({ setScreen }: TokenPageProps) => {
    //console.log(newLaunchData.current)
    const router = useRouter();
    const { sm, md, lg, xl } = useResponsive();
    const { newLaunchData } = useAppRoot();
    const [isLoading, setIsLoading] = useState(false);
    const [grindComplete, setGrindComplete] = useState(false);

    const [name, setName] = useState<string>(newLaunchData.current.name);
    const [symbol, setSymbol] = useState<string>(newLaunchData.current.symbol);
    const [displayImg, setDisplayImg] = useState<string>(newLaunchData.current.displayImg);
    const [tokenStart, setTokenStart] = useState<string>("");
    const [totalSupply, setTotalSupply] = useState<string>(newLaunchData.current.total_supply.toString());
    const [decimal, setDecimal] = useState<string>(newLaunchData.current.decimals.toString());
    const [mints, setMints] = useState<string>(newLaunchData.current.num_mints.toString());
    const [ticketPrice, setTotalPrice] = useState<string>(newLaunchData.current.ticket_price.toString());
    const [distribution, setDistribution] = useState<number[]>(newLaunchData.current.distribution);
    const [launch_type, setLaunchType] = useState<string>(getLaunchType(newLaunchData.current.launch_type));

    const [rewardsSupply, setRewardsSupply] = useState<string>("none");

    // token extensions
    const [transferFee, setTransferFee] = useState<string>(
        newLaunchData.current.transfer_fee > 0 ? newLaunchData.current.transfer_fee.toString() : "",
    );
    const [maxTransferFee, setMaxTransferFee] = useState<string>(
        newLaunchData.current.max_transfer_fee > 0 ? newLaunchData.current.max_transfer_fee.toString() : "",
    );
    const [permanentDelegate, setPermanentDelegate] = useState<string>("");
    const [transferHookID, setTransferHookID] = useState<string>("");

    const grind_attempts = useRef<number>(0);
    const grind_toast = useRef<any | null>(null);

    const { isOpen: isTooltipOpened, onOpen: openTooltip, onClose: closeTooltip } = useDisclosure();

    const handleNameChange = (e) => {
        setName(e.target.value);
    };
    const handleSymbolChange = (e) => {
        setSymbol(e.target.value);
    };

    useEffect(() => {
        if (launch_type !== "Instant") {
            return;
        }
        setTotalSupply("100000000");
        setDecimal("6");
        setTotalPrice("0");
        setMints("0");
        setDistribution([50, 50, 0, 0, 0, 0, 0]);
        setPermanentDelegate("");
        setTransferHookID("");
        setTransferFee("0");
        setMaxTransferFee("0");

        // we also set a bunch of other things
        newLaunchData.current.amm_fee = 25;
        newLaunchData.current.amm_provider = 0;
        newLaunchData.current.team_wallet = Config.COOK_FEES.toString();
    }, [launch_type, newLaunchData]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files && e.target.files[0];

        if (!file.type.startsWith("image")) {
            toast.error("Please upload an image file.");
            return;
        }

        if (file) {
            if (file.size <= 1048576) {
                const dimensions = await getImageDimensions(file);

                if (dimensions.width === dimensions.height) {
                    newLaunchData.current.icon_file = file;
                    setDisplayImg(URL.createObjectURL(e.target.files[0]));
                } else {
                    toast.error("Please upload an image with equal width and height.");
                }
            } else {
                toast.error("File size exceeds 1MB limit.");
            }
        }
    };

    const handleDistributionChange = (e, idx) => {
        let new_dist = [...distribution];
        new_dist[idx] = isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value);
        console.log(new_dist);
        setDistribution(new_dist);
    };

    function getTotalPercentage(distribution: number[]) {
        let total = 0;
        for (let i = 0; i < distribution.length; i++) {
            total += distribution[i];
        }
        return total;
    }
    // Calculate the total sum of all percentages
    const totalPercentage = getTotalPercentage(distribution);

    const tokenGrind = async () => {
        setIsLoading(true);
        if (grind_attempts.current === 0) {
            let est_time = "1s";
            if (tokenStart.length == 2) est_time = "5s";
            if (tokenStart.length === 3) est_time = "5-20min";
            grind_toast.current = toast.loading("Performing token prefix grind.. Est. time:  " + est_time);
            await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
            toast.update(grind_toast.current, {
                render: "Grind Attempts: " + grind_attempts.current.toString(),
                type: "info",
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        let success: boolean = false;
        for (let i = 0; i < 50000; i++) {
            grind_attempts.current++;
            /*let seed_buffer = [];

            for (let i = 0; i < 32; i++) {
                seed_buffer.push(Math.floor(Math.random() * 255));
            }
            
            let seed = new Uint8Array(seed_buffer);
*/
            newLaunchData.current.token_keypair = new Keypair(); //.fromSeed(seed);
            //console.log(newLaunchData.current.token_keypair.publicKey.toString(), tokenStart);
            if (newLaunchData.current.token_keypair.publicKey.toString().startsWith(tokenStart)) {
                success = true;
                console.log("have found key", newLaunchData.current.token_keypair.publicKey.toString());
                break;
            }
        }

        if (success) {
            let key_str = trimAddress(newLaunchData.current.token_keypair.publicKey.toString());

            //console.log("Took ", attempts, "to get pubkey", newLaunchData.current.token_keypair.publicKey.toString());
            toast.update(grind_toast.current, {
                render: "Token " + key_str + " found after " + grind_attempts.current.toString() + " attempts!",
                type: "success",
                isLoading: false,
                autoClose: 3000,
            });
            grind_attempts.current = 0;
            grind_toast.current = null;
            setIsLoading(false);
            setGrindComplete(true);

            console.log("returning true");
            return true;
        } else {
            // give the CPU a small break to do other things
            process.nextTick(function () {
                // continue working
                tokenGrind();
            });
            return false;
        }
    };

    function containsNone(str: string, set: string[]) {
        return str.split("").every(function (ch) {
            return set.indexOf(ch) === -1;
        });
    }

    let invalid_prefix_chars = [
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
        "I",
        "l",
        "0",
        "O",
    ];

    async function setData(e): Promise<boolean> {
        e.preventDefault();

        if (totalPercentage !== 100) {
            toast.error("The total percentage must add up to 100%.");
            return false;
        }

        if (newLaunchData.current.icon_file === null) {
            toast.error("Please select an icon image.");
            return false;
        }

        if (launch_type !== "None" && launch_type !== "Instant" && parseFloat(ticketPrice) < 0.00001) {
            toast.error("Minimum ticket price is 0.00001 SOL");
            return false;
        }

        if (symbol.length > 10) {
            toast.error("Maximum symbol length is 10 characters");
            return false;
        }

        if (name.length > 25) {
            toast.error("Maximum name length is 25 characters");
            return false;
        }

        if (distribution[Distribution.LP] === 0) {
            toast.error("Liquidity pool allocation must be greater than zero");
            return false;
        }

        if (distribution[Distribution.Raffle] === 0) {
            toast.error("Raffle allocation must be greater than zero");
            return false;
        }

        if (Math.pow(10, parseInt(decimal)) * parseInt(totalSupply) * (distribution[Distribution.Raffle] / 100) < parseInt(mints)) {
            toast.error("Not enough tokens to support the raffle");
            return false;
        }

        if (parseInt(totalSupply) < 10) {
            toast.error("Total supply of tokens must be over 10");
            return false;
        }

        if (!containsNone(tokenStart, invalid_prefix_chars)) {
            toast.error("Prefix contains invalid characters for token");
            return false;
        }

        let decimals = parseInt(decimal);
        if (isNaN(decimals) || decimals <= 0 || decimals > 9) {
            toast.error("Invalid decimal places (must be between 1 and 9)");
            return false;
        }

        newLaunchData.current.token_keypair = Keypair.generate();

        newLaunchData.current.launch_type = getLaunchTypeIndex(launch_type);

        newLaunchData.current.name = name;
        newLaunchData.current.symbol = symbol;
        newLaunchData.current.displayImg = displayImg;
        newLaunchData.current.total_supply = parseInt(totalSupply);
        newLaunchData.current.token_program = TOKEN_2022_PROGRAM_ID;

        newLaunchData.current.decimals = decimals;
        newLaunchData.current.num_mints = parseInt(mints);
        newLaunchData.current.ticket_price = parseFloat(ticketPrice);
        newLaunchData.current.minimum_liquidity = Math.round(parseFloat(mints) * parseFloat(ticketPrice));
        newLaunchData.current.distribution = distribution;

        newLaunchData.current.transfer_fee = parseFloat(transferFee);
        newLaunchData.current.max_transfer_fee = parseInt(maxTransferFee) * Math.pow(10, newLaunchData.current.decimals);

        if (permanentDelegate !== "") {
            newLaunchData.current.permanent_delegate = new PublicKey(permanentDelegate);
        }

        if (transferHookID !== "") {
            newLaunchData.current.transfer_hook_program = new PublicKey(transferHookID);
        }

        if (tokenStart !== "") {
            // Call tokenGrind() and wait for it to finish
            await tokenGrind();
        } else {
            setGrindComplete(true);
        }

        console.log("returning true");
        return true;
    }

    useEffect(() => {
        if (!grindComplete) {
            return;
        }

        setScreen("details");
    }, [grindComplete, setScreen]);

    async function nextPage(e) {
        console.log("in next page");
        await setData(e);
    }

    const Browse = () => (
        <HStack spacing={0} className={styles.eachField}>
            <p className="min-w-[110px] text-lg text-white md:min-w-[132px]">Icon:</p>
            <div>
                <label className={styles.label}>
                    <input id="file" type="file" onChange={handleFileChange} />
                    <span
                        className="rounded-3xl px-8 py-[0.6rem] font-semibold"
                        style={{
                            cursor: newLaunchData.current.edit_mode === true ? "not-allowed" : "pointer",
                            background: "linear-gradient(0deg, rgba(254, 106, 0, 1) 0%, rgba(236, 35, 0, 1) 100%)",
                        }}
                    >
                        Browse
                    </span>
                </label>
            </div>
            <span className="text-md ml-4 opacity-50">
                {newLaunchData.current.icon_file !== null ? newLaunchData.current.icon_file.name : "No File Selected"}
            </span>
        </HStack>
    );

    return (
        <form className="mx-auto flex w-full flex-col items-center justify-center bg-[#161616] bg-opacity-75 bg-clip-padding px-6 py-6 shadow-2xl backdrop-blur-sm backdrop-filter md:rounded-xl md:border-t-[3px] md:border-orange-700 md:px-12 md:py-8 lg:w-[1075px]">
            <Center height="100%" width="100%">
                <VStack height="100%" w="100%">
                    <div className="flex flex-col gap-2 md:mb-4">
                        <Text className="text-center text-3xl font-semibold text-white lg:text-4xl">Token Information</Text>
                        {/* <p className="text-center transition-all cursor-pointer text-white/50 hover:text-white">Switch to Advance Mode</p> */}
                    </div>
                    <VStack w={"100%"} spacing={25} mt={4}>
                        <HStack w="100%" spacing={lg ? 10 : 12} style={{ flexDirection: lg ? "column" : "row" }}>
                            {displayImg ? (
                                <Image
                                    src={displayImg}
                                    width={lg ? 180 : 235}
                                    height={lg ? 180 : 235}
                                    alt="Image Frame"
                                    style={{ backgroundSize: "cover", borderRadius: 12 }}
                                />
                            ) : (
                                <VStack
                                    justify="center"
                                    align="center"
                                    style={{ minWidth: lg ? 180 : 235, minHeight: lg ? 180 : 235, cursor: "pointer" }}
                                    borderRadius={12}
                                    border="2px dashed rgba(134, 142, 150, 0.5)"
                                    as={chakra.label}
                                    htmlFor="file"
                                >
                                    <Text mb={0} fontSize="x-large" color="white" opacity={0.25}>
                                        Icon Preview
                                    </Text>

                                    <chakra.input
                                        required
                                        style={{ display: "none" }}
                                        type="file"
                                        id="file"
                                        name="file"
                                        onChange={handleFileChange}
                                    />
                                </VStack>
                            )}

                            <VStack spacing={8} flexGrow={1} align="start" width="100%">
                                {lg && <Browse />}

                                <HStack spacing={0} className={styles.eachField}>
                                    <p className="min-w-[110px] text-lg text-white md:min-w-[132px]">Name:</p>

                                    <div className={styles.textLabelInput}>
                                        <Input
                                            placeholder="Enter Token Name. (Ex. Solana)"
                                            disabled={newLaunchData.current.edit_mode === true}
                                            size={lg ? "md" : "lg"}
                                            maxLength={25}
                                            required
                                            type="text"
                                            value={name}
                                            onChange={handleNameChange}
                                        />
                                    </div>
                                </HStack>

                                <HStack spacing={0} className={styles.eachField}>
                                    <p className="min-w-[110px] text-lg text-white md:min-w-[132px]">Ticker:</p>

                                    <div className={styles.textLabelInput}>
                                        <Input
                                            bg="#494949"
                                            placeholder="Enter Token Ticker. (Ex. $SOL)"
                                            disabled={newLaunchData.current.edit_mode === true}
                                            size={lg ? "md" : "lg"}
                                            maxLength={8}
                                            required
                                            type="text"
                                            value={symbol}
                                            onChange={handleSymbolChange}
                                        />
                                    </div>
                                </HStack>

                                <HStack spacing={0} className={styles.eachField}>
                                    <p className="min-w-[110px] text-lg text-white md:min-w-[132px]">Token Prefix:</p>

                                    <div className={styles.textLabelInput}>
                                        <Input
                                            maxLength={3}
                                            disabled={newLaunchData.current.edit_mode === true}
                                            size={lg ? "md" : "lg"}
                                            placeholder="Enter Token Prefix Grind (Max 3 Characters) - Optional"
                                            value={tokenStart}
                                            onChange={(e) => {
                                                setTokenStart(e.target.value);
                                            }}
                                        />
                                    </div>
                                </HStack>

                                {!lg && <Browse />}
                            </VStack>
                        </HStack>
                        <HStack spacing={8} w="100%" style={{ flexDirection: lg ? "column" : "row" }}>
                            <HStack spacing={0} className={styles.eachField}>
                                <p className="min-w-[110px] text-lg text-white md:min-w-[132px]">Total Supply:</p>

                                <div className={styles.textLabelInput}>
                                    <Input
                                        disabled={launch_type === "Instant" || newLaunchData.current.edit_mode === true}
                                        size={lg ? "md" : "lg"}
                                        required
                                        placeholder="Enter Token Total Supply"
                                        value={totalSupply}
                                        onChange={(e) => {
                                            setTotalSupply(e.target.value);
                                        }}
                                    />
                                </div>
                            </HStack>

                            <HStack spacing={lg ? 0 : 30} className={styles.eachField}>
                                <p className="min-w-[110px] text-lg text-white md:min-w-[132px] xl:min-w-fit">Decimals:</p>

                                <div className={styles.textLabelInput}>
                                    <Input
                                        disabled={launch_type === "Instant" || newLaunchData.current.edit_mode === true}
                                        size={lg ? "md" : "lg"}
                                        required
                                        placeholder="1-9"
                                        value={decimal}
                                        onChange={(e) => {
                                            setDecimal(e.target.value);
                                        }}
                                    />
                                </div>
                            </HStack>
                        </HStack>

                        <HStack spacing={0} className={styles.eachField}>
                            <p className="min-w-[110px] text-lg text-white md:min-w-[130px]">Launch Mode:</p>
                            <RadioGroup onChange={setLaunchType} value={launch_type} className="overflow-auto md:ml-[0.3125rem]">
                                <Stack direction="row" gap={5}>
                                    <Radio value="FCFS" color="white">
                                        <Tooltip
                                            label="Launch ends as soon as it is funded, first come first serve. "
                                            hasArrow
                                            fontSize="large"
                                            offset={[0, 10]}
                                        >
                                            <Text color="white" m={0} className="font-face-rk" fontSize={lg ? "medium" : "lg"}>
                                                FCFS
                                            </Text>
                                        </Tooltip>
                                    </Radio>
                                    <Radio value="Raffle">
                                        <Tooltip
                                            label="Launch Runs for a set period of time (default 24hrs), users can buy tickets to enter the raffle."
                                            hasArrow
                                            fontSize="large"
                                            offset={[0, 10]}
                                        >
                                            <Text color="white" m={0} className="font-face-rk" fontSize={lg ? "medium" : "lg"}>
                                                Raffle
                                            </Text>
                                        </Tooltip>
                                    </Radio>
                                    <Radio value="IDO">
                                        <Tooltip
                                            label="Launch Runs for a set period of time (default 24hrs).  If funded, tokens are distributed pro rata between all ticket holders."
                                            hasArrow
                                            fontSize="large"
                                            offset={[0, 10]}
                                        >
                                            <Text color="white" m={0} className="font-face-rk" fontSize={lg ? "medium" : "lg"}>
                                                IDO
                                            </Text>
                                        </Tooltip>
                                    </Radio>
                                    <Radio value="Instant">
                                        <Tooltip
                                            label="Token Launches instantly to trade with a bonding curve."
                                            hasArrow
                                            fontSize="large"
                                            offset={[0, 10]}
                                        >
                                            <Text color="white" m={0} className="font-face-rk" fontSize={lg ? "medium" : "lg"}>
                                                Instant
                                            </Text>
                                        </Tooltip>
                                    </Radio>
                                    <Radio value="None">
                                        <Tooltip
                                            label="No Launch, the token is created and sent to your wallet."
                                            hasArrow
                                            fontSize="large"
                                            offset={[0, 10]}
                                        >
                                            <Text color="white" m={0} className="font-face-rk" fontSize={lg ? "medium" : "lg"}>
                                                None
                                            </Text>
                                        </Tooltip>
                                    </Radio>
                                </Stack>
                            </RadioGroup>
                        </HStack>

                        <Divider />
                        <Text className="font-face-kg" color={"white"} fontSize="x-large" mb={0}>
                            Token Extensions:
                        </Text>
                        <VStack w="100%">
                            <VStack spacing={lg ? 8 : 10} w="100%">
                                <HStack spacing={8} w="100%" style={{ flexDirection: lg ? "column" : "row" }}>
                                    <HStack spacing={0} className={styles.eachField}>
                                        <p className="min-w-[110px] text-lg text-white md:min-w-[185px]">Transfer Fee:</p>

                                        <div className={styles.textLabelInput}>
                                            <Input
                                                disabled={
                                                    launch_type === "None" ||
                                                    launch_type === "Instant" ||
                                                    newLaunchData.current.edit_mode === true
                                                }
                                                size={lg ? "md" : "lg"}
                                                placeholder="Enter Transfer Fee in bps (Ex. 100 = 1%)"
                                                value={transferFee}
                                                onChange={(e) => {
                                                    setTransferFee(e.target.value);
                                                }}
                                            />
                                        </div>
                                    </HStack>

                                    <HStack spacing={lg ? 0 : 30} className={styles.eachField}>
                                        <p className="min-w-[110px] text-lg text-white md:min-w-[186px] xl:min-w-[75px]">Max Fee:</p>

                                        <div className={styles.textLabelInput}>
                                            <Input
                                                disabled={
                                                    launch_type === "None" ||
                                                    launch_type === "Instant" ||
                                                    newLaunchData.current.edit_mode === true
                                                }
                                                size={lg ? "md" : "lg"}
                                                placeholder="Max number of tokens taxed in a single transaction"
                                                value={maxTransferFee}
                                                onChange={(e) => {
                                                    setMaxTransferFee(e.target.value);
                                                }}
                                            />
                                        </div>
                                    </HStack>
                                </HStack>
                                <HStack w="100%" spacing={8} style={{ flexDirection: lg ? "column" : "row" }}>
                                    <HStack spacing={15} className={styles.eachField}>
                                        <p className="min-w-[110px] text-lg text-white md:min-w-[172px]">Permanent Delegate:</p>

                                        <HStack spacing={0} style={{ flexGrow: 1 }}>
                                            <div className={styles.textLabelInput} style={{ width: "95%", marginRight: "12px" }}>
                                                <Input
                                                    disabled={
                                                        launch_type === "None" ||
                                                        launch_type === "Instant" ||
                                                        newLaunchData.current.edit_mode === true
                                                    }
                                                    size={lg ? "md" : "lg"}
                                                    placeholder="Enter Permanent Delegate ID"
                                                    value={permanentDelegate}
                                                    onChange={(e) => {
                                                        setPermanentDelegate(e.target.value);
                                                    }}
                                                />
                                            </div>
                                            <Tooltip
                                                label="Will enforce transfer hook to stop delegate transfers from lets cook AMM"
                                                hasArrow
                                                fontSize="large"
                                                offset={[0, 10]}
                                            >
                                                <Image width={30} height={30} src="/images/help.png" alt="Help" />
                                            </Tooltip>
                                        </HStack>
                                    </HStack>
                                </HStack>
                                <HStack w="100%" spacing={8} style={{ flexDirection: lg ? "column" : "row" }}>
                                    <HStack spacing={15} className={styles.eachField}>
                                        <p className="w-[174px] text-lg text-white">Transfer Hook Program ID:</p>

                                        <HStack spacing={0} style={{ flexGrow: 1 }}>
                                            <div className={styles.textLabelInput} style={{ width: "95%", marginRight: "12px" }}>
                                                <Input
                                                    disabled={
                                                        launch_type === "None" ||
                                                        launch_type === "Instant" ||
                                                        newLaunchData.current.edit_mode === true
                                                    }
                                                    size={lg ? "md" : "lg"}
                                                    placeholder="Enter Transfer Hook Program ID"
                                                    value={transferHookID}
                                                    onChange={(e) => {
                                                        setTransferHookID(e.target.value);
                                                    }}
                                                />
                                            </div>
                                            <Tooltip
                                                label="Users must initialize the extra account metadata for the mint themselves"
                                                hasArrow
                                                fontSize="large"
                                                offset={[0, 10]}
                                            >
                                                <Image width={30} height={30} src="/images/help.png" alt="Help" />
                                            </Tooltip>
                                        </HStack>
                                    </HStack>
                                </HStack>

                                <Divider />

                                <Text mt={-3} className="font-face-kg" color={"white"} fontSize="x-large" mb={0}>
                                    Distribution:
                                </Text>

                                <HStack spacing={8} w="100%" justify="space-between" style={{ flexDirection: lg ? "column" : "row" }}>
                                    <HStack spacing={0} className={styles.eachField}>
                                        <p className="min-w-[110px] text-lg text-white md:min-w-[180px]">Winning Tickets:</p>

                                        <div className={styles.textLabelInput}>
                                            <Input
                                                placeholder={"Enter Total Number of Winning Tickets"}
                                                disabled={
                                                    launch_type === "None" ||
                                                    launch_type === "Instant" ||
                                                    newLaunchData.current.edit_mode === true
                                                }
                                                size={lg ? "md" : "lg"}
                                                required
                                                value={mints}
                                                onChange={(e) => {
                                                    setMints(e.target.value);
                                                }}
                                            />
                                        </div>
                                    </HStack>

                                    <HStack spacing={lg ? 0 : 8} className={styles.eachField}>
                                        <p className="min-w-[110px] text-lg text-white md:min-w-[180px] xl:min-w-[95px]">Ticket Price:</p>
                                        <div style={{ width: "100%" }} className={styles.textLabelInput}>
                                            <Input
                                                placeholder={"Enter Price Per Ticket"}
                                                disabled={
                                                    launch_type === "None" ||
                                                    launch_type === "Instant" ||
                                                    newLaunchData.current.edit_mode === true
                                                }
                                                size={lg ? "md" : "lg"}
                                                required
                                                value={ticketPrice}
                                                onChange={(e) => {
                                                    setTotalPrice(e.target.value);
                                                }}
                                            />
                                            <Image className={styles.sol} src={Config.token_image} height={30} width={30} alt="SOL" />
                                        </div>
                                    </HStack>
                                </HStack>

                                <HStack spacing={lg ? 0 : 1} className={styles.eachField}>
                                    <p className="min-w-[110px] text-lg text-white md:min-w-[180px]">Minimum Liquidity:</p>
                                    <div className={styles.textLabelInput}>
                                        <Input
                                            size={lg ? "md" : "lg"}
                                            required
                                            value={
                                                !isNaN(parseFloat(mints) * parseFloat(ticketPrice))
                                                    ? parseFloat(mints) * parseFloat(ticketPrice)
                                                    : 0
                                            }
                                            disabled
                                            style={{ cursor: "not-allowed" }}
                                            readOnly
                                        />
                                        <Image className={styles.sol} src={Config.token_image} height={30} width={30} alt="SOL" />
                                    </div>
                                </HStack>
                            </VStack>
                            <VStack mt={lg ? 2 : 5} spacing={5} w="100%" align="start">
                                <HStack
                                    justify="space-between"
                                    align={"center"}
                                    w="100%"
                                    style={{ flexDirection: md ? "column" : "row" }}
                                    spacing={15}
                                >
                                    <VStack
                                        spacing={5}
                                        align="start"
                                        w={md ? "100%" : "fit-content"}
                                        className={styles.distributionBoxFields}
                                    >
                                        <HStack spacing={5} mt={md ? 0 : 5}>
                                            <Box w={35} h={30} bg={distributionLabels.headers[0].color} />

                                            <p className="text-lg text-white">{distributionLabels.headers[0].title}</p>
                                        </HStack>

                                        <VStack
                                            pl={md ? 0 : 55}
                                            spacing={5}
                                            align="start"
                                            w={md ? "100%" : "530px"}
                                            className={styles.distributionBoxFields}
                                        >
                                            <HStack spacing={5} align="center" justify="space-between" w="100%">
                                                <HStack spacing={5}>
                                                    <Box w={35} h={30} bg={distributionLabels.fields[Distribution.Raffle].color} />

                                                    <p className="text-lg text-white">
                                                        {distributionLabels.fields[Distribution.Raffle].title}
                                                    </p>
                                                </HStack>
                                                <div className={styles.distributionField}>
                                                    <Input
                                                        size={"lg"}
                                                        required
                                                        value={distribution[Distribution.Raffle].toFixed(0)}
                                                        onChange={(e) => {
                                                            handleDistributionChange(e, Distribution.Raffle);
                                                        }}
                                                        disabled={
                                                            launch_type === "None" ||
                                                            launch_type === "Instant" ||
                                                            (totalPercentage === 100 && distribution[Distribution.Raffle] === 0
                                                                ? true
                                                                : false)
                                                        }
                                                    />
                                                    <Image
                                                        className={styles.percentage}
                                                        width={lg ? 15 : 20}
                                                        height={lg ? 15 : 20}
                                                        src="/images/perc.png"
                                                        alt="Percentage"
                                                    />
                                                </div>
                                            </HStack>

                                            <HStack spacing={5} align="center" justify="space-between" w="100%">
                                                <HStack spacing={5}>
                                                    <Box w={35} h={30} bg={distributionLabels.fields[Distribution.LP].color} />

                                                    <p className="text-lg text-white">{distributionLabels.fields[Distribution.LP].title}</p>
                                                </HStack>
                                                <div className={styles.distributionField}>
                                                    <Input
                                                        size="lg"
                                                        required
                                                        value={distribution[Distribution.LP].toFixed(0)}
                                                        onChange={(e) => {
                                                            handleDistributionChange(e, Distribution.LP);
                                                        }}
                                                        disabled={
                                                            launch_type === "None" ||
                                                            launch_type === "Instant" ||
                                                            (totalPercentage === 100 && distribution[Distribution.LP] === 0 ? true : false)
                                                        }
                                                    />
                                                    <Image
                                                        className={styles.percentage}
                                                        width={lg ? 15 : 20}
                                                        height={lg ? 15 : 20}
                                                        src="/images/perc.png"
                                                        alt="Percentage"
                                                    />
                                                </div>
                                            </HStack>
                                        </VStack>

                                        <HStack spacing={5} mt={md ? 0 : 5}>
                                            <Box w={35} h={30} bg={distributionLabels.headers[1].color} />

                                            <p className="text-lg text-white">{distributionLabels.headers[1].title}</p>
                                        </HStack>

                                        <VStack
                                            pl={md ? 0 : 55}
                                            spacing={5}
                                            align="start"
                                            w={md ? "100%" : "530px"}
                                            className={styles.distributionBoxFields}
                                        >
                                            <HStack spacing={5} align="center" justify="space-between" w="100%">
                                                <HStack spacing={5}>
                                                    <Box
                                                        w={35}
                                                        h={30}
                                                        bg={distributionLabels.fields[Distribution.MMRewards].color}
                                                        className="shrink-0"
                                                    />

                                                    <p className="text-lg text-white">
                                                        {distributionLabels.fields[Distribution.MMRewards].title}
                                                    </p>
                                                </HStack>
                                                <div className={styles.distributionField}>
                                                    <Input
                                                        size="lg"
                                                        required
                                                        value={distribution[Distribution.MMRewards].toFixed(0)}
                                                        onChange={(e) => {
                                                            handleDistributionChange(e, Distribution.MMRewards);
                                                        }}
                                                        disabled={
                                                            totalPercentage === 100 && distribution[Distribution.MMRewards] === 0
                                                                ? true
                                                                : false
                                                        }
                                                    />
                                                    <Image
                                                        className={styles.percentage}
                                                        width={lg ? 15 : 20}
                                                        height={lg ? 15 : 20}
                                                        src="/images/perc.png"
                                                        alt="Percentage"
                                                    />
                                                </div>
                                            </HStack>
                                        </VStack>

                                        <HStack spacing={5} mt={md ? 0 : 5}>
                                            <Box w={35} h={30} bg={distributionLabels.headers[2].color} />
                                            <p className="text-lg text-white">{distributionLabels.headers[2].title}</p>
                                        </HStack>

                                        <VStack
                                            pl={md ? 0 : 55}
                                            spacing={5}
                                            align="start"
                                            w={md ? "100%" : "530px"}
                                            className={styles.distributionBoxFields}
                                        >
                                            <HStack spacing={5} align="center" justify="space-between" w="100%">
                                                <HStack spacing={5}>
                                                    <Box
                                                        w={35}
                                                        h={30}
                                                        className="shrink-0"
                                                        bg={distributionLabels.fields[Distribution.LPRewards].color}
                                                    />
                                                    <p className="text-lg text-white">
                                                        {distributionLabels.fields[Distribution.LPRewards].title}
                                                    </p>
                                                </HStack>
                                                <div className={styles.distributionField}>
                                                    <Input
                                                        size="lg"
                                                        value={distribution[Distribution.LPRewards].toFixed(0)}
                                                        onChange={(e) => {
                                                            handleDistributionChange(e, Distribution.LPRewards);
                                                        }}
                                                        disabled={
                                                            totalPercentage === 100 && distribution[Distribution.LPRewards] === 0
                                                                ? true
                                                                : false
                                                        }
                                                    />
                                                    <Image
                                                        className={styles.percentage}
                                                        width={lg ? 15 : 20}
                                                        height={lg ? 15 : 20}
                                                        src="/images/perc.png"
                                                        alt="Percentage"
                                                    />
                                                </div>
                                            </HStack>

                                            <HStack spacing={5} align="center" justify="space-between" w="100%">
                                                <HStack spacing={5}>
                                                    <Box
                                                        w={35}
                                                        h={30}
                                                        className="shrink-0"
                                                        bg={distributionLabels.fields[Distribution.Team].color}
                                                    />
                                                    <p className="text-lg text-white">
                                                        {distributionLabels.fields[Distribution.Team].title}
                                                    </p>
                                                </HStack>
                                                <div className={styles.distributionField}>
                                                    <Input
                                                        size="lg"
                                                        value={distribution[Distribution.Team].toFixed(0)}
                                                        onChange={(e) => {
                                                            handleDistributionChange(e, Distribution.Team);
                                                        }}
                                                        disabled={
                                                            totalPercentage === 100 && distribution[Distribution.Team] === 0 ? true : false
                                                        }
                                                    />
                                                    <Image
                                                        className={styles.percentage}
                                                        width={lg ? 15 : 20}
                                                        height={lg ? 15 : 20}
                                                        src="/images/perc.png"
                                                        alt="Percentage"
                                                    />
                                                </div>
                                            </HStack>

                                            <HStack spacing={5} align="center" justify="space-between" w="100%">
                                                <HStack spacing={5}>
                                                    <Box w={35} h={30} bg={distributionLabels.fields[Distribution.Airdrops].color} />
                                                    <p className="text-lg text-white">
                                                        {distributionLabels.fields[Distribution.Airdrops].title}
                                                    </p>
                                                </HStack>
                                                <div className={styles.distributionField}>
                                                    <Input
                                                        size="lg"
                                                        value={distribution[Distribution.Airdrops].toFixed(0)}
                                                        onChange={(e) => {
                                                            handleDistributionChange(e, Distribution.Airdrops);
                                                        }}
                                                        disabled={
                                                            totalPercentage === 100 && distribution[Distribution.Airdrops] === 0
                                                                ? true
                                                                : false
                                                        }
                                                    />
                                                    <Image
                                                        className={styles.percentage}
                                                        width={lg ? 15 : 20}
                                                        height={lg ? 15 : 20}
                                                        src="/images/perc.png"
                                                        alt="Percentage"
                                                    />
                                                </div>
                                            </HStack>

                                            <HStack spacing={5} align="center" justify="space-between" w="100%">
                                                <HStack spacing={5}>
                                                    <Box w={35} h={30} bg={distributionLabels.fields[6].color} />
                                                    <p className="text-lg text-white">{distributionLabels.fields[6].title}</p>
                                                </HStack>

                                                <div className={styles.distributionField} style={{ marginLeft: "15px" }}>
                                                    <Input
                                                        size="lg"
                                                        value={distribution[Distribution.Other].toFixed(0)}
                                                        onChange={(e) => {
                                                            handleDistributionChange(e, Distribution.Other);
                                                        }}
                                                        disabled={
                                                            totalPercentage === 100 && distribution[Distribution.Other] === 0 ? true : false
                                                        }
                                                    />
                                                    <Image
                                                        className={styles.percentage}
                                                        width={lg ? 15 : 20}
                                                        height={lg ? 15 : 20}
                                                        src="/images/perc.png"
                                                        alt="Percentage"
                                                    />
                                                </div>
                                            </HStack>
                                        </VStack>
                                    </VStack>

                                    <VStack
                                        spacing={6}
                                        flexGrow={1}
                                        justify="center"
                                        align="center"
                                        py={8}
                                        h="fit-content"
                                        style={{ position: "relative" }}
                                    >
                                        <PieChart
                                            animate={true}
                                            totalValue={100}
                                            data={[
                                                {
                                                    title: "Raffle (SOL)",
                                                    value: distribution[Distribution.Raffle],
                                                    color: "#FF6651",
                                                },
                                                { title: "$TOKEN", value: distribution[Distribution.LP], color: "#FF9548" },

                                                {
                                                    title: "Market Maker Rewards",
                                                    value: distribution[Distribution.MMRewards],
                                                    color: "#66FF75",
                                                }, // integrate MM Rewards
                                                {
                                                    title: "Liquidity Provider Rewards",
                                                    value: distribution[Distribution.LPRewards],
                                                    color: "#41F4FF",
                                                },
                                                {
                                                    title: "Airdrops / Marketing",
                                                    value: distribution[Distribution.Airdrops],
                                                    color: "#8A7FFF",
                                                },
                                                { title: "Team", value: distribution[Distribution.Team], color: "#FFF069" },
                                                { title: "Others", value: distribution[Distribution.Other], color: "#FD98FE" },
                                                { title: "Blank", value: 100 - totalPercentage, color: "transparent" },
                                            ]}
                                            style={{ width: md ? "100%" : "380px", position: "absolute", zIndex: 2 }}
                                        />

                                        <PieChart
                                            animate={true}
                                            totalValue={100}
                                            data={[
                                                {
                                                    title: distributionLabels.headers[0].title,
                                                    value: distribution[Distribution.Raffle] + distribution[Distribution.LP],
                                                    color: distributionLabels.headers[0].color,
                                                },
                                                {
                                                    title: distributionLabels.headers[1].title,
                                                    value: distribution[Distribution.MMRewards],
                                                    color: distributionLabels.headers[1].color,
                                                },
                                                {
                                                    title: distributionLabels.headers[2].title,
                                                    value:
                                                        distribution[Distribution.LPRewards] +
                                                        distribution[Distribution.Airdrops] +
                                                        distribution[Distribution.Team] +
                                                        distribution[Distribution.Other],
                                                    color: distributionLabels.headers[2].color,
                                                },
                                            ]}
                                            style={{ width: md ? "120%" : "440px", position: "relative", zIndex: 1 }}
                                        />
                                    </VStack>
                                </HStack>
                            </VStack>
                        </VStack>

                        <Stack mt={md ? 0 : 30} direction={{ base: "column", md: "row" }}>
                            <Button
                                type="button"
                                size="lg"
                                className="mt-2"
                                onClick={(e) => () => router.push("/dashboard")}
                                style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="button"
                                size="lg"
                                className="mt-2"
                                onClick={(e) => {
                                    if (!isLoading) {
                                        nextPage(e);
                                    }
                                }}
                                style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
                            >
                                {isLoading ? <Spinner /> : `Next (1/3)`}
                            </Button>
                        </Stack>
                    </VStack>
                </VStack>

                <TooltipModal isTooltipOpened={isTooltipOpened} closeTooltip={closeTooltip} />
            </Center>
        </form>
    );
};

interface TooltipProps {
    isTooltipOpened?: boolean;
    closeTooltip?: () => void;
}

export function TooltipModal({ isTooltipOpened, closeTooltip }: TooltipProps) {
    const { sm } = useResponsive();

    return (
        <>
            <Modal size="md" isCentered isOpen={isTooltipOpened} onClose={closeTooltip} motionPreset="slideInBottom">
                <ModalOverlay />

                <ModalContent h={585} w={450} style={{ background: "transparent" }}>
                    <ModalBody bg="url(/images/terms-container.png)" bgSize={"contain"} bgRepeat={"no-repeat"} p={sm ? 10 : 14}>
                        <VStack gap={4} h="100%" position="relative" align="start" fontFamily="ReemKufiRegular">
                            <Text
                                m="0 auto"
                                align="center"
                                fontSize={"large"}
                                style={{
                                    fontFamily: "KGSummerSunshineBlackout",
                                    color: "white",
                                    fontWeight: "semibold",
                                }}
                            >
                                Market Rewards System
                            </Text>
                            <Text fontSize={sm ? "md" : "lg"} color="white" m={0}>
                                Support post-launch volume by allocating 5% or 10% of the supply to Let’s Cook users trading your token.
                            </Text>
                            <VStack m="0 auto">
                                <Image
                                    src="/images/rewards-chart.png"
                                    width={250}
                                    height={250}
                                    alt="Rewards Chart"
                                    style={{ backgroundColor: "white", borderRadius: "8px", padding: "12px" }}
                                />
                            </VStack>
                            <Text fontSize={sm ? "md" : "lg"} color="white" m={0}>
                                Rewards are calculated and distributed at the end of each day based on users’ trading volumes.
                            </Text>
                            <Text fontSize={sm ? "md" : "lg"} color="white" m={0} align="start">
                                Reward pools last for a period of 30 days.
                            </Text>
                        </VStack>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
}

export default TokenPage;
