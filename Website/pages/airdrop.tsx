import { useState, useMemo } from "react";
import {
    Box,
    Button,
    Input,
    Radio,
    RadioGroup,
    Stack,
    Text,
    FormControl,
    FormLabel,
    NumberInput,
    NumberInputField,
    VStack,
    HStack,
    useToast,
    Progress,
    IconButton,
    Link,
} from "@chakra-ui/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAirdrop } from "../hooks/useAirdrop";
import { PublicKey } from "@solana/web3.js";
import { RiDeleteBinLine, RiDownloadLine } from "react-icons/ri"; // Import the icon
import useResponsive from "@/hooks/useResponsive";
import styles from "../styles/Launch.module.css";
import { getMintData } from "@/components/amm/launch";
import { MintData } from "@/components/Solana/state";
import { set } from "date-fns";
import useTokenBalance from "@/hooks/data/useTokenBalance";
import Image from "next/image";

interface AirdropRecord {
    address: string; // wallet address
    currentBalance: string; // their token balance
    airdropAmount: string; // what they'll receive
    signature?: string; // transaction signature if airdrop completed
}

export const AirdropPage = () => {
    const { sm, md, lg } = useResponsive();
    const toast = useToast();
    const [mintAddress, setMintAddress] = useState("");
    const [airdroppedToken, setAirdroppedToken] = useState("");

    const [distributionType, setDistributionType] = useState<"fixed" | "even" | "proRata">("fixed");
    const [amount, setAmount] = useState("");
    const [threshold, setThreshold] = useState("0");
    const [airdropProgress, setAirdropProgress] = useState(0);
    const [isAirdropping, setIsAirdropping] = useState(false);

    const [signatures, setSignatures] = useState<Map<string, string>>(new Map());
    const {
        takeSnapshot,
        calculateAirdropAmounts,
        executeAirdrop,
        setHolders,
        filterHolders,
        setAirdroppedMint,
        holders,
        filteredHolders,
        snapshotMint,
        airdroppedMint,
        isLoading,
        error,
    } = useAirdrop();

    const distributions = useMemo(() => {
        if (!amount || !holders.length) return [];
        return calculateAirdropAmounts(amount, distributionType);
    }, [amount, holders, distributionType, calculateAirdropAmounts]);

    const handleMintInput = (value: string) => {
        setMintAddress(value);
        setAirdropProgress(0);
    };

    const handleAirdropInput = async () => {
        let airdroppedMint = await getMintData(airdroppedToken);
        setAirdroppedMint(airdroppedMint);
    };

    const handleThresholdChange = (value: string) => {
        setThreshold(value);
        let thresholdFloat = parseFloat(value);
        if (isFinite(thresholdFloat)) {
            filterHolders(value);
        }
    };

    const handleSnapshot = async (e) => {
        console.log(mintAddress, "mintAddress");
        try {
            if (!mintAddress) {
                toast({
                    title: "Error",
                    description: "Please enter a mint address",
                    status: "error",
                });
                return;
            }

            let snapshotMint = await getMintData(mintAddress);

            if (!snapshotMint) {
                toast({
                    title: "Error",
                    description: "Invalid mint address",
                    status: "error",
                });
                return;
            }

            const minThreshold = parseFloat(threshold);
            if (isNaN(minThreshold)) {
                toast({
                    title: "Error",
                    description: "Invalid Threshold",
                    status: "error",
                });
                return;
            }

            await takeSnapshot(snapshotMint, minThreshold);

            toast({
                title: "Success",
                description: "Token holder snapshot completed",
                status: "success",
            });
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to take snapshot",
                status: "error",
            });
        }
    };

    const handleAirdrop = async () => {
        try {
            setIsAirdropping(true);
            const newSignatures = new Map<string, string>();

            await executeAirdrop(distributions, (progress, signature, recipientAddresses) => {
                setAirdropProgress(progress * 100);

                if (signature && recipientAddresses) {
                    recipientAddresses.forEach((address) => {
                        newSignatures.set(address, signature);
                    });
                    setSignatures(new Map(newSignatures));
                }
            });

            toast({
                title: "Success",
                description: "Airdrop completed successfully",
                status: "success",
            });
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to execute airdrop",
                status: "error",
            });
        } finally {
            setIsAirdropping(false);
        }
    };

    const handleDeleteHolder = (addressToDelete: string) => {
        // Update holders directly
        const newHolders = holders.filter((holder) => holder.address !== addressToDelete);
        setHolders(newHolders);
    };

    // The download handler function
    const handleDownloadCSV = () => {
        try {
            // 1. Create records from holders data
            const records: AirdropRecord[] = filteredHolders.map((holder) => {
                const distribution = distributions.find((d) => d.address === holder.address);
                return {
                    address: holder.address,
                    currentBalance: holder.balance,
                    airdropAmount: distribution?.amount || "0",
                    signature: "aaaaaaaa", //signatures.get(holder.address) || ''
                };
            });

            // 2. Create CSV header row and format data rows
            const csvRows = [
                // Header row
                ["Wallet Address", "Current Balance", "Airdrop Amount", "Transaction Signature"],
                // Data rows
                ...records.map((record) => [record.address, record.currentBalance, record.airdropAmount, record.signature]),
            ];

            // 3. Convert to CSV string (handle potential commas in data)
            const csvContent = csvRows
                .map((row) =>
                    row
                        .map((cell) =>
                            // Wrap in quotes if contains comma
                            cell.includes(",") ? `"${cell}"` : cell,
                        )
                        .join(","),
                )
                .join("\n");

            // 4. Create and trigger download
            const blob = new Blob([csvContent], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            // Use mint address and timestamp in filename
            link.setAttribute("download", `airdrop_${mintAddress.slice(0, 8)}_${new Date().toISOString().split("T")[0]}.csv`);

            // 5. Trigger download and cleanup
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            toast({
                title: "Error",
                description: "Failed to download CSV",
                status: "error",
            });
        }
    };

    const { tokenBalance: airdroppedMintTokenBalance } = useTokenBalance(airdroppedMint ? { mintData: airdroppedMint } : null);
    const { tokenBalance: snapshotMintTokenBalance } = useTokenBalance(snapshotMint ? { mintData: snapshotMint } : null);
    return (
        <form className="mx-auto mt-5 flex w-full flex-col items-center justify-center bg-[#161616] bg-opacity-75 bg-clip-padding px-8 py-6 shadow-2xl backdrop-blur-sm backdrop-filter md:rounded-xl md:border-t-[3px] md:border-orange-700 md:px-12 md:py-8 lg:w-[1075px]">
            <div className="flex flex-col gap-2 mb-4">
                <Text className="text-3xl font-semibold text-center text-white lg:text-4xl">Snapshot / Airdrop Tool</Text>
                {/* <p className="text-center transition-all cursor-pointer text-white/50 hover:text-white">Switch to Advance Mode</p> */}
            </div>
            <Box w={"100%"} mx="auto">
                <VStack spacing={6} align="stretch">
                    {/* Input Section */}
                    <FormControl>
                        <FormLabel className="min-w-[100px] text-lg text-white">Token / Collection Address</FormLabel>
                        <HStack>
                            <div className={styles.textLabelInput}>
                                <Input
                                    className="text-white"
                                    placeholder="Enter token mint address"
                                    size={lg ? "md" : "lg"}
                                    required
                                    type="text"
                                    value={mintAddress}
                                    onChange={(e) => handleMintInput(e.target.value)}
                                />
                            </div>
                            <Button
                                className="!bg-custom-gradient text-white"
                                onClick={handleSnapshot}
                                isLoading={isLoading}
                                loadingText="Loading"
                            >
                                Get Holders
                            </Button>
                        </HStack>
                    </FormControl>

                    {/* Token Info */}
                    {snapshotMint && (
                        <Box>
                            <FormLabel className="min-w-[100px] text-lg text-white">Token Info</FormLabel>

                            <Box className="flex flex-col w-1/3 p-3 text-white bg-gray-800 rounded-md gap-y-2">
                                {snapshotMint && (
                                    <>
                                        <div className="flex flex-col gap-2 w-fit">
                                            <button className="flex items-center gap-2 rounded-lg bg-gray-700 px-2.5 py-1.5">
                                                <div className="">
                                                    <Image
                                                        src={snapshotMint.icon}
                                                        width={25}
                                                        height={25}
                                                        alt="Eth Icon"
                                                        className="rounded-full"
                                                    />
                                                </div>
                                                <span>{snapshotMint.name}</span>
                                            </button>
                                        </div>
                                        <span className="flex justify-between w-full">
                                            <b>Decimals:</b>
                                            <Text> {snapshotMint.mint.decimals}</Text>
                                        </span>
                                        <span className="flex justify-between w-full">
                                            <b>Symbol:</b>
                                            <Text> {snapshotMint.symbol}</Text>
                                        </span>
                                        <span className="flex justify-between w-full">
                                            <b>Token Balance:</b>
                                            <Text> {snapshotMintTokenBalance}</Text>
                                        </span>
                                    </>
                                )}
                            </Box>
                        </Box>
                    )}

                    {/* Threshold Input */}
                    <FormControl>
                        <FormLabel className="min-w-[100px] text-lg text-white">Minimum Balance Threshold</FormLabel>
                        <div className={styles.textLabelInput}>
                            <Input
                                className="text-white"
                                size={lg ? "md" : "lg"}
                                type="number"
                                value={threshold}
                                onChange={(e) => handleThresholdChange(e.target.value)}
                                min={0}
                            />
                        </div>
                    </FormControl>

                    {/* Distribution Type Selection */}
                    <FormControl className="text-white">
                        <FormLabel className="min-w-[100px] text-lg text-white">Distribution Type</FormLabel>
                        <RadioGroup value={distributionType} onChange={(value: "fixed" | "even" | "proRata") => setDistributionType(value)}>
                            <Stack direction="row">
                                <Radio value="fixed">Fixed Amount Per Holder</Radio>
                                <Radio value="even">Even Split Per Holder</Radio>
                                <Radio value="proRata">Pro Rata Split</Radio>
                            </Stack>
                        </RadioGroup>
                    </FormControl>

                    <FormControl>
                        <FormLabel className="min-w-[100px] text-lg text-white">Airdrop Mint Address</FormLabel>
                        <HStack>
                            <div className={styles.textLabelInput}>
                                <Input
                                    className="text-white"
                                    placeholder="Enter airdrop mint address"
                                    size={lg ? "md" : "lg"}
                                    required
                                    type="text"
                                    value={airdroppedToken}
                                    onChange={(e) => setAirdroppedToken(e.target.value)}
                                />
                            </div>
                            <Button
                                className="!bg-custom-gradient text-white"
                                onClick={() => handleAirdropInput()}
                                isLoading={isLoading}
                                loadingText="Loading"
                            >
                                Set
                            </Button>
                        </HStack>
                    </FormControl>

                    {/* Token Info */}

                    {airdroppedMint && (
                        <Box>
                            <FormLabel className="min-w-[100px] text-lg text-white">Token Info</FormLabel>

                            <Box className="flex flex-col w-1/3 p-3 text-white bg-gray-800 rounded-md gap-y-2">
                                {airdroppedMint && (
                                    <>
                                        <div className="flex flex-col gap-2 w-fit">
                                            <button className="flex items-center gap-2 rounded-lg bg-gray-700 px-2.5 py-1.5">
                                                <div className="">
                                                    <Image
                                                        src={airdroppedMint.icon}
                                                        width={25}
                                                        height={25}
                                                        alt="Eth Icon"
                                                        className="rounded-full"
                                                    />
                                                </div>
                                                <span>{airdroppedMint.name}</span>
                                            </button>
                                        </div>
                                        <span className="flex justify-between w-full">
                                            <b>Decimals:</b>
                                            <Text> {airdroppedMint.mint.decimals}</Text>
                                        </span>
                                        <span className="flex justify-between w-full">
                                            <b>Symbol:</b>
                                            <Text> {airdroppedMint.symbol}</Text>
                                        </span>
                                        <span className="flex justify-between w-full">
                                            <b>Token Balance:</b>
                                            <Text> {airdroppedMintTokenBalance}</Text>
                                        </span>
                                    </>
                                )}
                            </Box>
                        </Box>
                    )}

                    {/* Amount Input */}
                    <FormControl>
                        <FormLabel className="min-w-[100px] text-lg text-white">
                            {distributionType === "fixed" ? "Amount Per Holder" : "Total Amount to Distribute"}
                        </FormLabel>
                        <div className={styles.textLabelInput}>
                            <Input
                                className="text-white"
                                size={lg ? "md" : "lg"}
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min={0}
                            />
                        </div>
                    </FormControl>

                    {/* Holders Table */}
                    {holders.length > 0 && (
                        <Box overflowX="auto">
                            <Button
                                leftIcon={<RiDownloadLine />} // Using react-icons
                                colorScheme="teal"
                                size="sm"
                                mb={4}
                                onClick={handleDownloadCSV}
                                disabled={holders.length === 0}
                            >
                                Download CSV
                            </Button>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[140px]">Wallet</TableHead>
                                        <TableHead className="min-w-[140px]">Current Balance</TableHead>
                                        <TableHead className="min-w-[140px]">Will Receive</TableHead>
                                        <TableHead className="min-w-[140px]">Signature</TableHead>
                                        <TableHead className="min-w-[140px]">Remove</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredHolders
                                        .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
                                        .map((holder) => {
                                            const distribution = distributions.find((d) => d.address === holder.address);
                                            const signature = signatures.get(holder.address);

                                            return (
                                                <TableRow
                                                    key={holder.address}
                                                    className="transition-colors cursor-pointer hover:bg-muted/50"
                                                >
                                                    <TableCell className="font-mono text-sm">
                                                        {holder.address.slice(0, 4)}...{holder.address.slice(-4)}
                                                    </TableCell>
                                                    <TableCell>{holder.balance}</TableCell>
                                                    <TableCell>{distribution?.amount || "0"}</TableCell>
                                                    <TableCell>
                                                        {signature && (
                                                            <a
                                                                href={`https://solscan.io/tx/${signature}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-mono text-sm text-blue-500 hover:text-blue-600"
                                                            >
                                                                {signature.slice(0, 4)}...{signature.slice(-4)}
                                                            </a>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <IconButton
                                                            aria-label="Remove address"
                                                            icon={<RiDeleteBinLine />}
                                                            size="sm"
                                                            colorScheme="red"
                                                            variant="ghost"
                                                            onClick={() => handleDeleteHolder(holder.address)}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                </TableBody>
                            </Table>
                            {/* Airdrop Progress */}
                            {isAirdropping && (
                                <Box mt={4}>
                                    <Progress value={airdropProgress} />
                                </Box>
                            )}

                            {/* Airdrop Button */}
                            <div className="flex justify-center w-full">
                                <Button
                                    mt={4}
                                    colorScheme="green"
                                    onClick={handleAirdrop}
                                    isLoading={isAirdropping}
                                    loadingText="Airdropping"
                                    disabled={!distributions.length}
                                    className="!bg-custom-gradient"
                                >
                                    Start Airdrop
                                </Button>
                            </div>
                        </Box>
                    )}

                    {/* Error Display */}
                    {error && <Text color="red.500">{error}</Text>}
                </VStack>
            </Box>
        </form>
    );
};

export default AirdropPage;
