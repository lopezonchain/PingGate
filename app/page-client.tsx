// src/app/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, ReactNode, useRef } from "react";
import { useAccount, useWalletClient, useConnect } from "wagmi";
import { useSearchParams } from "next/navigation";
import {
  useMiniKit,
  useAddFrame,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
  WalletModal,
} from "@coinbase/onchainkit/wallet";
import { sdk } from '@farcaster/frame-sdk';

import { base,baseSepolia, monadTestnet} from "wagmi/chains";
import PingGateHome from "./components/PingGateHome";
import InboxScreen from "./components/InboxScreen";
import MyPlansScreen from "./components/MyServicesScreen";
import ReviewsScreen from "./components/ReviewsScreen";
import ExploreScreen from "./components/ExploreScreen";
import MyServicesScreen from "./components/MyServicesScreen";

export type WarpView = "home" | "inbox" | "myplans" | "explore" | "reviews" ;

const chainOptions = [
  { label: "Sepolia", chain: baseSepolia },
  { label: "Base", chain: base },
  { label: "Monad Testnet", chain: monadTestnet }
] as const;


type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  icon?: ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  disabled = false,
  type = "button",
  icon,
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0052FF] disabled:opacity-50 disabled:pointer-events-none";

  const variantClasses = {
    primary:
      "bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-background)]",
    secondary:
      "bg-[var(--app-gray)] hover:bg-[var(--app-gray-dark)] text-[var(--app-foreground)]",
    outline:
      "border border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] text-[var(--app-accent)]",
    ghost:
      "hover:bg-[var(--app-accent-light)] text-[var(--app-foreground-muted)]",
  };

  const sizeClasses = {
    sm: "text-xs px-2.5 py-1.5 rounded-md",
    md: "text-sm px-4 py-2 rounded-lg",
    lg: "text-base px-6 py-3 rounded-lg",
  };

  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="flex items-center mr-2">{icon}</span>}
      {children}
    </button>
  );
}

type IconProps = {
  name: "heart" | "star" | "check" | "plus" | "arrow-right";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Icon({ name, size = "md", className = "" }: IconProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const icons = {
    heart: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Heart</title>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    star: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Star</title>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    check: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Check</title>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    plus: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Plus</title>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    "arrow-right": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Arrow Right</title>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    ),
  };

  return (
    <span className={`inline-block ${sizeClasses[size]} ${className}`}>
      {icons[name]}
    </span>
  );
}

export default function Page(): JSX.Element {
  const { address } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { data: walletClient } = useWalletClient();
  const searchParams = useSearchParams();
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const addFrame = useAddFrame();

  const [warpView, setWarpView] = useState<WarpView>("home");
  const [frameAdded, setFrameAdded] = useState(false);
  const [selectedChain, setSelectedChain] = useState<any>(base);
  const triedAutoConnect = useRef(false);

  useEffect(() => {
    if (!isFrameReady) setFrameReady();
    (async () => {
      await sdk.actions.ready({ disableNativeGestures: true });
    })();
  }, [isFrameReady, setFrameReady]);

  useEffect(() => {
    if (!triedAutoConnect.current && !address && connectors.length) {
      triedAutoConnect.current = true;
      const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
      connectAsync({ connector: injected });
    }
  }, [address, connectors, connectAsync]);

  useEffect(() => {
    if (walletClient) {
      const found = chainOptions.find((o) => o.chain.id === walletClient.chain.id);
      if (found && selectedChain.id !== found.chain.id) {
        setSelectedChain(found.chain);
      }
    }
  }, [walletClient, selectedChain.id]);

  useEffect(() => {
    const w = searchParams.get("wallet");
    const a = searchParams.get("amount");
    // TODO if (w && a) setWarpView("send");
  }, [searchParams]);

  const handleAddFrame = useCallback(async () => {
    const added = await addFrame();
    setFrameAdded(Boolean(added));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button variant="ghost" size="sm" onClick={handleAddFrame} className="p-4" icon={<Icon name="plus" size="sm" />}>
          Save Miniapp
        </Button>
      );
    }
    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
          <Icon name="check" size="sm" className="text-[#0052FF]" />
          <span>Saved</span>
        </div>
      );
    }
    return null;
  }, [context, frameAdded, handleAddFrame]);

  const handleChainChange = async (id: number) => {
    const found = chainOptions.find((o) => o.chain.id === id);
    if (found && walletClient) {
      try {
        await walletClient.switchChain({ id });
        setSelectedChain(found.chain);
      } catch (error: any) {
        if (error.code === 4902) {
          try {
            await walletClient.addChain({ chain: found.chain });
            await walletClient.switchChain({ id });
            setSelectedChain(found.chain);
          } catch (addError) {
            console.error("Error adding chain:", addError);
          }
        } else {
          console.error("Error switching chain:", error);
        }
      }
    }
  };

  const handleBack = () => setWarpView("home");

  return (
    <div className="flex flex-col bg-[#0f0d14] font-sans text-[var(--app-foreground)] mini-app-theme">
      <div className="w-full max-w-md mx-auto px-4 py-3 h-screen flex flex-col">
        <header className="flex justify-between items-center mb-3 h-11">
          <div className="flex justify-end space-x-2 w-full z-50">

            <Wallet>
              <ConnectWallet>
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>

            <div className="ml-4">{saveFrameButton}</div>
          </div>
          
        </header>

        <main className="flex-1">
          {warpView === "home" && <PingGateHome onAction={(view) => setWarpView(view)} />}
          {warpView === "inbox" && (<InboxScreen onBack={() => setWarpView("home")} />)}
          {warpView === "myplans" && (<MyServicesScreen onBack={() => setWarpView("home")} />)}
          {warpView === "explore" && (<ExploreScreen onBack={() => setWarpView("home")} />)}
          {warpView === "reviews" && (<ReviewsScreen onBack={() => setWarpView("home")} />)}
        </main>
      </div>
       <WalletModal isOpen={false} onClose={function (): void {
        throw new Error("Function not implemented.");
      } } />
    </div>
  );
}
