import { expect } from "chai";
import hre from "hardhat";

describe("FreelanceEscrow", function () {

  async function deployContract() {
    const { ethers } = await hre.network.connect();

    const [client, freelancer, arbitrator, otherUser] =
      await ethers.getSigners();

    const FreelanceEscrow =
      await ethers.getContractFactory("FreelanceEscrow");

    const escrow = await FreelanceEscrow.deploy(
      arbitrator.address
    );

    await escrow.waitForDeployment();

    return {
      ethers,
      escrow,
      client,
      freelancer,
      arbitrator,
      otherUser
    };
  }

  describe("Deployment", function () {

    it("should set the correct arbitrator", async function () {

      const {
        escrow,
        arbitrator
      } = await deployContract();

      expect(await escrow.arbitrator())
        .to.equal(arbitrator.address);
    });

  });

  describe("Escrow Creation", function () {

    it("should create and fund an escrow", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      const amount = ethers.parseEther("1");

      const tx = await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      await tx.wait();

      const escrowData =
        await escrow.getEscrowDetails(1);

      expect(escrowData[0]).to.equal(1n);
      expect(escrowData[1]).to.equal(client.address);
      expect(escrowData[2]).to.equal(freelancer.address);
      expect(escrowData[3]).to.equal(amount);

      // FUNDED = 1
      expect(escrowData[4]).to.equal(1n);

      expect(await escrow.getContractBalance())
        .to.equal(amount);
    });

    it("should reject zero-value escrow", async function () {

      const {
        escrow,
        freelancer
      } = await deployContract();

      await expect(
        escrow.createEscrow(
          freelancer.address,
          { value: 0 }
        )
      ).to.be.revertedWith(
        "Escrow amount must be greater than zero"
      );
    });

    it("should reject invalid freelancer address", async function () {

      const {
        escrow,
        ethers
      } = await deployContract();

      await expect(
        escrow.createEscrow(
          ethers.ZeroAddress,
          {
            value: ethers.parseEther("1")
          }
        )
      ).to.be.revertedWith(
        "Invalid freelancer address"
      );
    });

    it("should reject client as freelancer", async function () {

      const {
        escrow,
        client,
        ethers
      } = await deployContract();

      await expect(
        escrow
          .connect(client)
          .createEscrow(
            client.address,
            {
              value: ethers.parseEther("1")
            }
          )
      ).to.be.revertedWith(
        "Client cannot be freelancer"
      );
    });

  });

  describe("Work Lifecycle", function () {

    it("should allow freelancer to start work", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      const amount = ethers.parseEther("1");

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      await escrow
        .connect(freelancer)
        .startWork(1);

      const data =
        await escrow.getEscrowDetails(1);

      // IN_PROGRESS = 2
      expect(data[4]).to.equal(2n);
    });

    it("should allow freelancer to submit work", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      const amount = ethers.parseEther("1");

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      await escrow
        .connect(freelancer)
        .startWork(1);

      await escrow
        .connect(freelancer)
        .submitWork(1);

      const data =
        await escrow.getEscrowDetails(1);

      // SUBMITTED = 3
      expect(data[4]).to.equal(3n);
    });

    it("should reject unauthorized user starting work", async function () {

      const {
        escrow,
        client,
        freelancer,
        otherUser,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await expect(
        escrow
          .connect(otherUser)
          .startWork(1)
      ).to.be.revertedWith(
        "Only freelancer can perform this action"
      );
    });

    it("should reject submitting work before starting", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await expect(
        escrow
          .connect(freelancer)
          .submitWork(1)
      ).to.be.revertedWith(
        "Work must be in progress"
      );
    });

  });

  describe("Payment Release", function () {

    it("should release payment to freelancer after client approval", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      const amount = ethers.parseEther("1");

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      await escrow
        .connect(freelancer)
        .startWork(1);

      await escrow
        .connect(freelancer)
        .submitWork(1);

      const balanceBefore =
        await ethers.provider.getBalance(
          freelancer.address
        );

      await escrow
        .connect(client)
        .approveAndReleasePayment(1);

      const balanceAfter =
        await ethers.provider.getBalance(
          freelancer.address
        );

      expect(balanceAfter - balanceBefore)
        .to.equal(amount);

      const data =
        await escrow.getEscrowDetails(1);

      // COMPLETED = 4
      expect(data[4]).to.equal(4n);

      expect(data[3]).to.equal(0n);

      expect(await escrow.getContractBalance())
        .to.equal(0n);
    });

    it("should reject payment release before work submission", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await expect(
        escrow
          .connect(client)
          .approveAndReleasePayment(1)
      ).to.be.revertedWith(
        "Work has not been submitted"
      );
    });

    it("should reject unauthorized payment release", async function () {

      const {
        escrow,
        client,
        freelancer,
        otherUser,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await escrow
        .connect(freelancer)
        .startWork(1);

      await escrow
        .connect(freelancer)
        .submitWork(1);

      await expect(
        escrow
          .connect(otherUser)
          .approveAndReleasePayment(1)
      ).to.be.revertedWith(
        "Only client can perform this action"
      );
    });

  });

  describe("Cancellation and Refund", function () {

    it("should allow client to cancel before work starts", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      const amount = ethers.parseEther("1");

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      await escrow
        .connect(client)
        .cancelAndRefund(1);

      const data =
        await escrow.getEscrowDetails(1);

      // REFUNDED = 7
      expect(data[4]).to.equal(7n);

      expect(data[3]).to.equal(0n);

      expect(await escrow.getContractBalance())
        .to.equal(0n);
    });

    it("should reject cancellation after work has started", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await escrow
        .connect(freelancer)
        .startWork(1);

      await expect(
        escrow
          .connect(client)
          .cancelAndRefund(1)
      ).to.be.revertedWith(
        "Escrow cannot be cancelled now"
      );
    });

  });

  describe("Dispute Management", function () {

    it("should allow client to raise a dispute", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await escrow
        .connect(client)
        .raiseDispute(1);

      const data =
        await escrow.getEscrowDetails(1);

      // DISPUTED = 6
      expect(data[4]).to.equal(6n);
    });

    it("should allow freelancer to raise a dispute", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await escrow
        .connect(freelancer)
        .startWork(1);

      await escrow
        .connect(freelancer)
        .raiseDispute(1);

      const data =
        await escrow.getEscrowDetails(1);

      expect(data[4]).to.equal(6n);
    });

    it("should reject dispute from unauthorized user", async function () {

      const {
        escrow,
        client,
        freelancer,
        otherUser,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await expect(
        escrow
          .connect(otherUser)
          .raiseDispute(1)
      ).to.be.revertedWith(
        "Only project participants allowed"
      );
    });

    it("should allow arbitrator to resolve dispute in favor of freelancer", async function () {

      const {
        escrow,
        client,
        freelancer,
        arbitrator,
        ethers
      } = await deployContract();

      const amount = ethers.parseEther("1");

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      await escrow
        .connect(client)
        .raiseDispute(1);

      const freelancerBefore =
        await ethers.provider.getBalance(
          freelancer.address
        );

      await escrow
        .connect(arbitrator)
        .resolveDispute(
          1,
          true
        );

      const freelancerAfter =
        await ethers.provider.getBalance(
          freelancer.address
        );

      expect(
        freelancerAfter - freelancerBefore
      ).to.equal(amount);

      const data =
        await escrow.getEscrowDetails(1);

      // COMPLETED = 4
      expect(data[4]).to.equal(4n);

      expect(data[3]).to.equal(0n);
    });

    it("should allow arbitrator to resolve dispute in favor of client", async function () {

      const {
        escrow,
        client,
        freelancer,
        arbitrator,
        ethers
      } = await deployContract();

      const amount = ethers.parseEther("1");

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      await escrow
        .connect(client)
        .raiseDispute(1);

      const clientBefore =
        await ethers.provider.getBalance(
          client.address
        );

      await escrow
        .connect(arbitrator)
        .resolveDispute(
          1,
          false
        );

      const clientAfter =
        await ethers.provider.getBalance(
          client.address
        );

      expect(
        clientAfter - clientBefore
      ).to.equal(amount);

      const data =
        await escrow.getEscrowDetails(1);

      // REFUNDED = 7
      expect(data[4]).to.equal(7n);

      expect(data[3]).to.equal(0n);
    });

    it("should reject dispute resolution from non-arbitrator", async function () {

      const {
        escrow,
        client,
        freelancer,
        otherUser,
        ethers
      } = await deployContract();

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          {
            value: ethers.parseEther("1")
          }
        );

      await escrow
        .connect(client)
        .raiseDispute(1);

      await expect(
        escrow
          .connect(otherUser)
          .resolveDispute(
            1,
            true
          )
      ).to.be.revertedWith(
        "Only arbitrator can perform this action"
      );
    });

  });

  describe("Project ID Management", function () {

    it("should increment project IDs", async function () {

      const {
        escrow,
        client,
        freelancer,
        ethers
      } = await deployContract();

      const amount = ethers.parseEther("1");

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      await escrow
        .connect(client)
        .createEscrow(
          freelancer.address,
          { value: amount }
        );

      expect(
        await escrow.getNextProjectId()
      ).to.equal(3n);
    });

  });

});