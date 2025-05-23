# PingGate

[![MIT License](https://img.shields.io/badge/license-MIT-green)](#license) [![Version](https://img.shields.io/badge/version-0.1.0-blue)](#)
<div align="center">
  Chat privately with wallet to wallet encryption. Monetize your inbox or talk with experts.- Platform powered by XMTP, Farcaster & Base
<br/><br/>
  <img
    src="https://pinggate.lopezonchain.xyz/PingGateLogo.png"
    alt="PingGate logo"
    width="150"
    height="150"
  />
</div>

---

## 💬 What is PingGate?

**PingGate** is a decentralized chat app where users can get paid to receive messages.  
Creators, mentors, and experts can define access tiers (plans) for DMs, consultations, or services — all managed through smart contracts on Base and powered by XMTP.

---

## 🚀 Features

- **Farcaster & Coinbase Miniapp**, also available on desktop  
- **Wallet-to-wallet communication**: Via XMTP, wallet to wallet, end2end encryption... start owning your conversations!
- **Monetize your Inbox**: If you start offering a service, people will have to pay to contact you.
- **Custom plans**: Experts define services (e.g., consulting, support, review) if you don't, anyone can contact you completely free. 
- **Social integration**: Farcaster accounts, names, feed integration.
- **Review system**: Buyers can rate and leave feedback.

---

## 🔧 Tech Stack

- **Frontend**: Next · React · TypeScript · Tailwind CSS  
- **Smart Contract**: Solidity ^0.8.20 · Hardhat · OpenZeppelin  
- **Wallet Integration**: Onchainkit · wagmi · viem  
- **Messaging**: XMTP  
- **Social**: Farcaster (Notifications, feed integrations)

---

## 🏗️ Getting Started

### Prerequisites

- Node.js v16+  
- Yarn or npm  

### Installation

```bash
# Clone the repo
git clone https://github.com/lopezonchain/PingGate.git
cd pinggate

# Install dependencies
npm install   # or yarn install

# Start the dev server
npm run dev

# Open in browser
# http://localhost:3000
```

## 📈 Usage

- **Inbox**: View and reply to conversations.
- **Pay-to-Ping**: Start conversations with experts that started services by selecting a paid plan. Payment unlocks direct chat access.
- **My Services**: Create and manage your own service offerings (consulting, support, feedback).
- **Explore**: Browse other users' profiles and plans. Pay and start chatting instantly.
- **Farcaster Identity**: Link your FID to build trust and visibility in the decentralized social space.

## 🤝 Contributing

We ❤️ contributions! Please follow these steps:

1. Fork the repo  
2. Create a branch:  
   ```bash
   git checkout -b feature/your-feature
   ```  
3. Commit your changes:  
   ```bash
   git commit -m "Add awesome feature"
   ```  
4. Push to branch:  
   ```bash
   git push origin feature/your-feature
   ```  
5. Open a Pull Request  

Feel free to open issues for bugs, feature requests, or general feedback.

## 📜 License

Distributed under the MIT License.  
See [LICENSE](LICENSE) for details.

## Created using MiniKit Template

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-onchain --mini`](), configured with:

- [MiniKit](https://docs.base.org/builderkits/minikit/overview)
- [OnchainKit](https://www.base.org/builders/onchainkit)
- [Tailwind CSS](https://tailwindcss.com)
- [Next.js](https://nextjs.org/docs)
