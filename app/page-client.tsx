// src/app/page-client.tsx
"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { useAccount, useWalletClient, useConnect } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { useMiniKit, useAddFrame } from "@coinbase/onchainkit/minikit";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
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
import { sdk } from "@farcaster/frame-sdk";

import { base, baseSepolia } from "wagmi/chains";
import PingGateHome from "./components/PingGateHome";
import InboxScreen from "./components/InboxScreen";
import ReviewsScreen from "./components/ReviewsScreen";
import ExploreScreen from "./components/ExploreScreen";
import MyServicesScreen from "./components/MyServicesScreen";
import FAQScreen from "./components/FAQScreen";
import toast from "react-hot-toast";
import Link from "next/link";

export type WarpView =
  | "home"
  | "inbox"
  | "myservices"
  | "explore"
  | "reviews"
  | "faq";

const chainOptions = [
  { label: "Sepolia", chain: baseSepolia },
  { label: "Base", chain: base },
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
};

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
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]
        } ${className}`}
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
};

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { data: walletClient } = useWalletClient();

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // inicializar warpView desde la query o "home"
  const initialView = (searchParams.get("view") ?? "home") as WarpView;
  const [warpView, setWarpView] = useState<WarpView>(initialView);

  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const addFrame = useAddFrame();
  const [frameAdded, setFrameAdded] = useState(false);
  const triedAutoConnect = useRef(false);

  const [farcasterContext, setFarcasterContext] = useState<any>(null);

    // Preparar OnChainKit frame
  useEffect(() => {
    if (!isFrameReady) setFrameReady();
    sdk.actions.ready({ disableNativeGestures: true });
  }, [isFrameReady, setFrameReady]);

  useEffect(() => {
    let mounted = true;
    sdk.context
      .then((ctx) => {
        if (mounted) setFarcasterContext(ctx);
      })
      .catch((err) => {
        console.error("failed to load Farcaster context", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // if the walletClient is ready, call switchChain once on load
    if (walletClient && walletClient.chain?.id !== base.id) {
      walletClient
        .switchChain(base)
        .catch(() => {
          // user may reject—but we'll also listen to chainChanged below
        });
    }

    // now listen to any manual chain changes in the wallet UI
    const ethereum = (window as any).ethereum;
    if (ethereum && ethereum.on) {
      const handleChainChanged = (chainIdHex: string) => {
        const chainId = parseInt(chainIdHex, 16);
        if (chainId !== base.id) {
          ethereum
            .request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${base.id.toString(16)}` }],
            })
            .catch(() => {
              toast.error("Please switch back to the Base network");
            });
        }
      };
      ethereum.on("chainChanged", handleChainChanged);

      return () => {
        ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [walletClient]);

  // sincronizar warpView cada vez que cambie la query param
  useEffect(() => {
    const v = (searchParams.get("view") ?? "home") as WarpView;
    setWarpView(v);
  }, [searchParams]);

  // Detectar conexión y establecer flag
  useEffect(() => {
    if (address) {
      try {
        localStorage.setItem("wagmiDidManualConnect", "true");
      } catch {
        /* ignore if localStorage is unavailable */
      }
    }
  }, [address]);

  // Auto-conectar wallet inyectada
  useEffect(() => {
    let didManual = false;
    try {
      didManual = localStorage.getItem("wagmiDidManualConnect") === "true";
    } catch {
      /* localStorage might be unavailable */
    }

    if (
      didManual &&                    // only after first manual connect
      !triedAutoConnect.current &&    // haven’t tried this session yet
      !address &&                     // not already connected
      connectors.length                // have at least one connector
    ) {
      triedAutoConnect.current = true;
      const injected =
        connectors.find((c) => c.id === "injected") ?? connectors[0];
      connectAsync({ connector: injected });
    }
  }, [address, connectors, connectAsync]);

  // Forzar Base si cambia de chain
  useEffect(() => {
    if (walletClient && walletClient.chain?.id !== base.id) {
      walletClient.switchChain(base).catch(() => { });
    }
  }, [walletClient]);

  // onAction que hace push shallow y actualiza warpView
  const onAction = useCallback(
    (view: WarpView) => {
      router.push(`?view=${view}`);
      // setWarpView(view); // no es necesario, el efecto lo sincroniza
    },
    [router]
  );

  const handleAddFrame = useCallback(async () => {
    const added = await addFrame();
    setFrameAdded(Boolean(added));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="md"
          onClick={handleAddFrame}
          className="p-1"
          icon={<Icon name="star" size="sm" />}
        >
          Enable Notifications
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

  return (
    <div className="flex flex-col bg-[#0f0d14] font-sans text-[var(--app-foreground)] mini-app-theme">
      <div className="w-full max-w-md mx-auto px-1 h-screen flex flex-col">
        <header className="flex justify-end items-center mb-3 h-11">
          <Link href="/?view=home" shallow>
            <img src="/PingGateLogoNoBG.png" alt="PingGate Home" className="w-12 h-12" />
          </Link>
          <div className="flex justify-end space-x-2 w-full z-50 pt-2">
            <Wallet>
              {address ? (
                <>
                  <ConnectWallet>
                    <Avatar className="h-6 w-6" />
                    <Name />
                  </ConnectWallet>
                  <WalletDropdown classNames={{
                    container: 'max-sm:pb-20'
                  }}>
                    <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                      <Avatar />
                      <Name />
                      <Address />
                      <EthBalance />
                    </Identity>
                    <WalletDropdownDisconnect />
                  </WalletDropdown>
                </>
                ) : farcasterContext ? (
                <Button
                  onClick={() => connectAsync({ connector: farcasterFrame() })}
                  variant="primary"
                  size="md"
                  className="cursor-pointer ock-bg-primary hover:bg-[var(--ock-bg-primary-hover)] active:bg-[var(--ock-bg-primary-active)] ock-border-radius ock-font-family font-semibold ock-text-inverse inline-flex items-center justify-center px-4 py-3 min-w-[153px]"
                >
                  Connect Farcaster
                </Button>
              ) : (
                // if not connected, show our own connect button
                <Button
                  onClick={() => setIsWalletModalOpen(true)}
                  variant="primary"
                  size="md"
                  className={`cursor-pointer ock-bg-primary hover:bg-[var(--ock-bg-primary-hover)] active:bg-[var(--ock-bg-primary-active)] ock-border-radius ock-font-family font-semibold ock-text-inverse inline-flex items-center justify-center px-4 py-3 min-w-[153px]`}
                >
                  Connect
                </Button>
              )}
            </Wallet>
            <div className="ml-4">{saveFrameButton}</div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          {warpView === "home" && <PingGateHome onAction={onAction} />}
          {warpView === "inbox" && <InboxScreen onAction={onAction} />}
          {warpView === "myservices" && (
            <MyServicesScreen onAction={onAction} />
          )}
          {warpView === "explore" && <ExploreScreen onAction={onAction} />}
          {warpView === "reviews" && <ReviewsScreen onAction={onAction} />}
          {warpView === "faq" && <FAQScreen onAction={onAction} />}
        </main>
      </div>

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
        }}
      />
    </div>
  );
}