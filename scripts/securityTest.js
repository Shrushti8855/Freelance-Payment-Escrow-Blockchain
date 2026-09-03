import hre from "hardhat";

async function main() {
    const { ethers } = await hre.network.connect();

    const escrow = await ethers.getContractAt(
        "FreelanceEscrow",
        "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    );

    const arbitrator = await escrow.arbitrator();

    console.log("Configured arbitrator:");
    console.log(arbitrator);

    console.log("\nAccount #0:", (await ethers.getSigners())[0].address);
    console.log("Account #1:", (await ethers.getSigners())[1].address);
    console.log("Account #2:", (await ethers.getSigners())[2].address);
    console.log("Account #3:", (await ethers.getSigners())[3].address);

    const details = await escrow.getEscrowDetails(2);

    console.log("\nProject #2 amount:", ethers.formatEther(details[3]), "ETH");
    console.log("Project #2 state:", details[4].toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});