require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./model/user");
const Flutterwave = require('flutterwave-node-v3');
const app = express();

app.use(express.json());


const User = require("./model/user");

const Wallet = require("./model/wallet");
const WalletTransaction = require("./model/wallet_transaction");
const Transaction = require("./model/transaction");


app.post("/signup", (req, res) => {
    try {
        
        const { first_name, last_name, email, password } = req.body;
    
        if (!(email && password && first_name && last_name)) {
          res.status(400).send("All input is required");
        }
    
        const oldUser = await User.findOne({ email });
    
        if (oldUser) {
          return res.status(409).send("User Already Exist. Please Login");
        }
    
        encryptedPassword = await bcrypt.hash(password, 10);
    
        const user = await User.create({
          first_name,
          last_name,
          email: email.toLowerCase(), 
          password: encryptedPassword,
        });
    
        // Create token
        const token = jwt.sign(
          { user_id: user._id, email },
          process.env.TOKEN_KEY,
          {
            expiresIn: "2h",
          }
        );
        
        user.token = token;
    
        
        res.status(201).json(user);
      } catch (err) {
        console.log(err);
      }
      
    });


app.post("/login", (req, res) => {
    try {
        
        const { email, password } = req.body;
    
        if (!(email && password)) {
          res.status(400).send("All input is required");
        }
        
        const user = await User.findOne({ email });
    
        if (user && (await bcrypt.compare(password, user.password))) {
        
          const token = jwt.sign(
            { user_id: user._id, email },
            process.env.TOKEN_KEY,
            {
              expiresIn: "2h",
            }
          );
    
          user.token = token;
    
          res.status(200).json(user);
        }
        res.status(400).send("Invalid Credentials");
      } catch (err) {
        console.log(err);
      }
      
});

//...
const validateUserWallet = async (userId) => {
  try {
    const userWallet = await Wallet.findOne({ userId });

    if (!userWallet) {
      
      const wallet = await Wallet.create({
        userId,
      });
      return wallet;
    }
    return userWallet;
  } catch (error) {
    console.log(error);
  }
};


const createWalletTransaction = async (userId, status, currency, amount) => {
  try {
    
    const walletTransaction = await WalletTransaction.create({
      amount,
      userId,
      isInflow: true,
      currency,
      status,
    });
    return walletTransaction;
  } catch (error) {
    console.log(error);
  }
};


const createTransaction = async (
  userId,
  id,
  status,
  currency,
  amount,
  customer
) => {
  try {

    const transaction = await Transaction.create({
      userId,
      transactionId: id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone_number,
      amount,
      currency,
      paymentStatus: status,
      paymentGateway: "flutterwave",
    });
    return transaction;
  } catch (error) {
    console.log(error);
  }
};

const updateWallet = async (userId, amount) => {
  try {
    const wallet = await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { balance: amount } },
      { new: true }
    );
    return wallet;
  } catch (error) {
    console.log(error);
  }
};

app.get("/createwallet", async (req, res) => {
  const { transaction_id } = req.query;

  const url = `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`;

  const response = await axios({
    url,
    method: "get",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `${process.env.FLW_SECRET_KEY}`,
    },
  });

  const { status, currency, id, amount, customer } = response.data.data;

  const user = await User.findOne({ email: customer.email });
  const wallet = await validateUserWallet(user._id);
  await createWalletTransaction(user._id, status, currency, amount);
  await createTransaction(user._id, id, status, currency, amount, customer);

  await updateWallet(user._id, amount);

  return res.status(200).json({
    response: "wallet funded successfully",
    data: wallet,
  });
});

const transfer_between_users = async (bank, accountNumber, Amount, Currency, Narration) => {
  const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
  app.get("/wallet/:userId/transfers", async (req, res) => {
    try {
      const { userId } = req.params;
  
      const wallet = await Wallet.findOne({ userId });
      if(wallet.balance>Amount){
        const details = {
          account_bank: bank,
          account_number: accountNumber,
          amount: Amount,
          narration: Narration,
          currency: Currency,
          reference: generateTransactionReference(),
          callback_url: "https://webhook.site/b3e505b0-fe02-430e-a538-22bbbce8ce0d",
          debit_currency: debitCurrency
      };
      flw.Transfer.initiate(details)
          .then(console.log)
          .then(x=>{
            res.status(200).json(x)
          })
          .catch(console.log);
      }
      
    } catch (err) {
      console.log(err);
    }
  });

}

module.exports = app;
