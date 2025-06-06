import React, { useCallback, useEffect, useState } from "react";
import { WebUploader } from "@irys/web-upload";
import { WebEclipseEth } from "@irys/web-upload-solana";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "react-toastify";
import { Config } from "@/components/Solana/constants";

interface IrysUploaderState {
    irysUploader: any | null;
    isLoading: boolean;
    error: string | null;
}

export const useIrysUploader = () => {
    const wallet = useWallet();
    const [state, setState] = useState<IrysUploaderState>({
        irysUploader: null,
        isLoading: false,
        error: null,
    });

    const getIrysUploader = useCallback(async () => {
        if (!wallet || !wallet.connected) {
            console.log("🔴 Wallet not connected for Irys uploader");
            return null;
        }

        try {
            console.log("🔵 Creating Irys web uploader...");
            setState((prev) => ({ ...prev, isLoading: true, error: null }));

            const irysUploader = await WebUploader(WebEclipseEth).withProvider(wallet).withRpc(Config.RPC_NODE).mainnet();

            console.log("✅ Irys web uploader created successfully");
            console.log(`Connected to Irys from ${irysUploader.address}`);

            setState((prev) => ({ ...prev, irysUploader, isLoading: false }));
            return irysUploader;
        } catch (error) {
            console.error("❌ Error creating Irys uploader:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            setState((prev) => ({ ...prev, error: errorMessage, isLoading: false }));
            toast.error("Failed to initialize Irys uploader");
            return null;
        }
    }, [wallet]);

    const fundAccount = useCallback(
        async (bytes: number) => {
            if (!state.irysUploader) {
                console.log("🔴 No Irys uploader available for funding");
                return false;
            }

            try {
                console.log(`🔵 Funding account for ${bytes} bytes...`);

                // Get the price for the upload
                const price = await state.irysUploader.getPrice(bytes);
                console.log(`💰 Cost: ${price} atomic units`);

                // Simply fund the required amount (lazy funding approach)
                console.log("🔵 Funding account with required amount...");
                await state.irysUploader.fund(price);
                console.log("✅ Account funded successfully");
                toast.success("Account funded successfully");

                return true;
            } catch (error) {
                console.error("❌ Error funding account:", error);
                toast.error("Failed to fund account");
                return false;
            }
        },
        [state.irysUploader],
    );

    const uploadFile = useCallback(
        async (file: File, tags: Array<{ name: string; value: string }> = []) => {
            if (!state.irysUploader) {
                console.log("🔴 No Irys uploader available for upload");
                return null;
            }

            try {
                console.log(`🔵 Uploading file: ${file.name} (${file.size} bytes)`);

                // Fund account if needed
                const funded = await fundAccount(file.size);
                if (!funded) {
                    throw new Error("Failed to fund account");
                }

                // Upload file
                const response = await state.irysUploader.upload(file, { tags });
                console.log("✅ File uploaded successfully:", response.id);

                toast.success("File uploaded successfully!");
                return response;
            } catch (error) {
                console.error("❌ Error uploading file:", error);
                toast.error("Failed to upload file");
                return null;
            }
        },
        [state.irysUploader, fundAccount],
    );

    const uploadFiles = useCallback(
        async (files: File[], toastText: string = "files") => {
            if (!state.irysUploader) {
                console.log("🔴 No Irys uploader available for upload");
                return null;
            }

            try {
                const totalSize = files.reduce((sum, file) => sum + file.size, 0);
                console.log(`🔵 Uploading ${files.length} files (${totalSize} bytes total)`);

                // Fund account if needed
                const funded = await fundAccount(totalSize);
                if (!funded) {
                    throw new Error("Failed to fund account");
                }

                // Convert files to tagged files
                const taggedFiles = files.map((file) => {
                    const taggedFile = file as any;
                    taggedFile.tags = [{ name: "Content-Type", value: file.type }];
                    return taggedFile;
                });

                // Upload files as a folder
                const response = await state.irysUploader.uploadFolder(taggedFiles);
                console.log("✅ Files uploaded successfully:", response.id);

                toast.success(`${toastText} uploaded successfully!`);
                return response;
            } catch (error) {
                console.error("❌ Error uploading files:", error);
                toast.error(`Failed to upload ${toastText}`);
                return null;
            }
        },
        [state.irysUploader, fundAccount],
    );

    useEffect(() => {
        if (wallet && wallet.connected && !state.irysUploader && !state.isLoading) {
            getIrysUploader();
        }
    }, [wallet, wallet.connected, state.irysUploader, state.isLoading, getIrysUploader]);

    return {
        irysUploader: state.irysUploader,
        isLoading: state.isLoading,
        error: state.error,
        getIrysUploader,
        fundAccount,
        uploadFile,
        uploadFiles,
    };
};
