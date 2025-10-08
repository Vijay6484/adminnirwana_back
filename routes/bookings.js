const express = require("express");

const router = express.Router();

const pool = require("../dbcon");

const crypto = require("crypto");

const PayU = require("payu-websdk");

const nodemailer = require("nodemailer");

const puppeteer = require("puppeteer");

const { format } = require("date-fns");

const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

const payu_key = process.env.PAYU_MERCHANT_KEY ||"n5ikm0"; //process.env.PAYU_MERCHANT_KEY;

const payu_salt = process.env.PAYU_MERCHANT_SALT||"diKKGjJv3yODMXnmPF48WXaQLWoBJaD2";

// "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCS2TYPoivPA9qOZW+c+evpYJGF9I6Ti/FVL3+3AyEImmWr9kd8NXRnWkRw79JmzJ+wUL1HkuloTCEvOcnoN16sd2bQ3n4j2WRca0QkHbx4JougH3NKfUkVIo2n21xlaxu9xiIjMZF1OQbNhMJfid/vP7FSaUhLdN46aWvyjxohK30IRvGnXbOH3666UtJXDSvebtrClLfUdX/9zOXLUU45vncGyCtylNiADLW5dMR5EkB8vQwpFXbQ+79LG9RRSDD8yCIJbd8Z4EB5gt1rQwdiUeV2T45ncSETFNKudUtwt/SxffzQPH5qDiyU2D35Cc5lUQQmELjK9aLYI/ge6ss1AgMBAAECggEAFxolc2GttzBxxIeoPr+hsdIvqq2N9Z/lPGPP2ZScMIyLtLk2x09oi+7rSAIurV4BPF2DXZx67F3XtaSHg2kck5DoQ7FREmY7r/9vFah480ULH8p62ovpwLGyK+dqeokWcO1YBwXgDptFWvVJF/sql+rDBIZMKZTN9k4J/buuHmwKQEqOowUBQWP1oo0Sgrnv48nQqlPfGatxq7U4w4hRLf3l6UR0c/mPHVb00UabBaZzZ9B/jMMasHDtLKYQ/69VtCo2QVm9Kykh3bRHKjiAF5f606gHiewILi3jj+lcnUrcDL1pFkBqskrJ8NibHfdJkaT1w3W1n463cLfCCntD2QKBgQC67h1lGo3avoB4GdoGMzqsDg9Bub0FpI2/lnL5oeFgygRvYRBb78E3fUKuYIWcUjiZaTgukIsMtZKPEpv90tJXua5dQEOOip9D4SQddHoT7MNToFFKJ5pXzHonc8dSMQYLV3LeR1V/9inJhrRPjedhr1jdJBMLZIAOe/mZBDh8CQKBgQDJG7zPL0sua6WkX6lLX0JydmEjbOFedeL2olY3pm8Vj0iC1ejUzsYrRwHEc1YUr2bO0NQ0uQ64dLhl+AXu2HwCWu7aRKMas0lg4uFemcmerqUMd1ozJJfI3fhjfSaFXwSqn5LcclUCXt/LOx49cxN9HmPHYNpyvV+P17gchIG4zQKBgCL95+rBKcTE3G+fBz0Z4eXLS/fVuRiRUSeIFkW8k9/2cRYYaWOMYfLtM8pIrzov+gBdvfKZhC4A30qBBUpiaJWbYJR8LylDscSXJJeO8jtAmt/QpubmuvGsiUFRXwJ3wtXkrNAHMm4dunzLBn3N5n5WwJ/E3PvI+F+9vV9zds9hAoGAdz5eHo8RSe4EIkmibRGHqaztff7SRpspv0mUS50A4sy5lvJVAtG0CPcqYhxtHwi9scV6/eP4iYCT0cpVYkC0jwTx+TOXbn599Nex/9C6Dr/JF3IxZn+9DBopbHxJee1ULANAJjwYkbZFhhCAprj0Bk0dppuUC1KkNfsXrLkY3cUCgYAYdRxY9KFg97jhRyD25LKTHbLyp5+rd53UxxNM5GGaxwHCe0FPj9jTD9x6NoGIg1cLDeaTIy20a4cDJx5v50yrMFvnbIMCcQ4nm71GfXUtO53O/k4ptTk9jVlM8ymJ/kK0956OODrrCTz/4Sur4+11gkd1LAw+MfKHZ8gtWrswPQ=="; //process.env.PAYU_MERCHANT_SALT;

const PAYU_BASE_URL =process.env.PAYU_BASE_URL || "https://test.payu.in"  //'https://secure.payu.in';

const FRONTEND_BASE_URL =process.env.FRONTEND_BASE_URL || "https://nirwanastays.com";

const ADMIN_BASE_URL =process.env.ADMIN_BASE_URL || "https://api.nirwanastays.com";

// BOOKING CLEANUP JOB

const bookingCleanup = () => {
  setInterval(async () => {
    try {
      const [result] = await pool.execute(
        `UPDATE bookings 

         SET payment_status = 'expired'

         WHERE payment_status = 'pending'

         AND created_at < NOW() - INTERVAL 1 HOUR`
      );

      console.log(`Marked ${result.affectedRows} bookings as expired`);
    } catch (error) {
      console.error("Booking cleanup error:", error);
    }
  }, 30 * 60 * 1000); // every 30 minutes
};

bookingCleanup();

// GET /admin/bookings - fetch all bookings

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const [bookings] = await pool.execute(
      `

      SELECT 

        b.id,

        b.guest_name,

        b.guest_email,

        b.guest_phone,
        b.food_veg,
        b.food_nonveg,
        b.food_jain,

        a.name AS accommodation_name,

        DATE_FORMAT(b.check_in, '%Y-%m-%d') AS check_in,

        DATE_FORMAT(b.check_out, '%Y-%m-%d') AS check_out,






        b.adults,

        b.children,

        b.rooms,

        b.total_amount,

        b.advance_amount,

        b.payment_status,

        b.payment_txn_id,

        b.created_at




      FROM bookings b

      LEFT JOIN accommodations a ON b.accommodation_id = a.id

      ORDER BY b.created_at DESC

      LIMIT ? OFFSET ?

    `,
      [parseInt(limit), parseInt(offset)]
    );

    const [[{ count }]] = await pool.execute(
      "SELECT COUNT(*) as count FROM bookings"
    );

    res.json({
      success: true,

      data: bookings,

      pagination: {
        total: count,

        page: parseInt(page),

        limit: parseInt(limit),

        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);

    res.status(500).json({
      success: false,

      error: "Failed to fetch bookings",

      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /admin/bookings - create booking

router.post("/", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      guest_name,
      guest_email,
      guest_phone,
      accommodation_id,
      package_id,

      check_in,
      check_out,
      adults = 1,
      children = 0,
      rooms = 1,

      food_veg = 0,
      food_nonveg = 0,
      food_jain = 0,
      total_amount,

      advance_amount = 0,
      payment_method = "payu",
    } = req.body;

    console.log(req.body);

    const requiredFields = [
      "guest_name",
      "accommodation_id",
      "package_id",
      "check_in",
      "check_out",
      "total_amount",
    ];

    const missingFields = requiredFields.filter(
      (field) => req.body[field] === undefined || req.body[field] === null
    );

    console.log(missingFields);

    if (missingFields.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const totalGuests = adults + children;

    const totalFood = food_veg + food_nonveg + food_jain;

    if (totalFood !== totalGuests) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Food preferences must match total guests",
        });
    }

    if (new Date(check_in) >= new Date(check_out)) {
      return res
        .status(400)
        .json({ success: false, error: "Check-out must be after check-in" });
    }

    if (total_amount <= 0 || advance_amount < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid amount values" });
    }

    if (adults < 1 || rooms < 1) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Must have at least 1 adult and 1 room",
        });
    }

    const payment_status = "pending";

    const payment_txn_id = `BOOK-${uuidv4()}`;

    const [result] = await connection.execute(
      `

      INSERT INTO bookings (

        guest_name, guest_email, guest_phone, accommodation_id, package_id,

        check_in, check_out, adults, children, rooms, food_veg, food_nonveg, 

        food_jain, total_amount, advance_amount, payment_status, payment_txn_id, created_at

      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

      [
        guest_name,
        guest_email,
        guest_phone || null,
        accommodation_id,
        package_id,

        check_in,
        check_out,
        adults,
        children,
        rooms,
        food_veg,
        food_nonveg,

        food_jain,
        total_amount,
        advance_amount,
        payment_status,
        payment_txn_id,
        new Date(),
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      data: { booking_id: result.insertId, payment_txn_id, payment_status },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Error creating booking:", error);

    res.status(500).json({
      success: false,

      error: "Failed to create booking",

      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    connection.release();
  }
});

router.post("/offline", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      guest_name,
      guest_email,
      guest_phone,
      accommodation_id,

      check_in,
      check_out,
      adults = 1,
      children = 0,
      rooms = 1,

      food_veg = 0,
      food_nonveg = 0,
      food_jain = 0,

      total_amount,
      advance_amount = 0,
      coupon,         
      discount,       
      full_amount     
    } = req.body;

    // Validate required fields

    const requiredFields = [
      "guest_name",
      "guest_email",
      "accommodation_id",
      "check_in",
      "check_out",
      "total_amount",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    // Validate food count vs guest count

    const totalGuests = adults + children;

    const totalFood = food_veg + food_nonveg + food_jain;

    if (totalFood > 0 && totalFood !== totalGuests) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Food preferences must match total guests",
        });
    }

    // Validate check-in/out dates

    if (new Date(check_in) >= new Date(check_out)) {
      return res
        .status(400)
        .json({ success: false, error: "Check-out must be after check-in" });
    }

    // Validate positive values

    if (total_amount <= 0 || advance_amount < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid amount values" });
    }

    if (adults < 1 || rooms < 1) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Must have at least 1 adult and 1 room",
        });
    }

    const payment_status = "success";

    const payment_txn_id = `BOOK-${uuidv4()}`;

    // Insert into bookings

    const [result] = await connection.execute(
      `

      INSERT INTO bookings (

        guest_name, guest_email, guest_phone, accommodation_id,

        check_in, check_out, adults, children, rooms, food_veg, food_nonveg,

        food_jain, total_amount, advance_amount, payment_status, payment_txn_id, created_at

      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

      [
        guest_name,
        guest_email,
        guest_phone || null,
        accommodation_id,

        check_in,
        check_out,
        adults,
        children,
        rooms,
        food_veg,
        food_nonveg,

        food_jain,
        total_amount,
        advance_amount,
        payment_status,
        payment_txn_id,
        new Date(),
      ]
    );

    const booking_id = result.insertId;

    // Fetch booking details with accommodation

    const [[booking]] = await connection.execute(
      `

      SELECT b.*, a.name AS accommodation_name, a.address AS accommodation_address,

             a.latitude, a.longitude, a.owner_id

      FROM bookings b

      JOIN accommodations a ON b.accommodation_id = a.id

      WHERE b.id = ?`,
      [booking_id]
    );

    let ownerEmail = null;

    // Get owner email using owner_id

    if (booking.owner_id) {
      const [[user]] = await connection.execute(
        `

        SELECT email FROM users WHERE id = ?

      `,
        [booking.owner_id]
      );

      ownerEmail = user?.email || null;
    }

    await connection.commit();

    const formatDate = (dateStr) => {
      const d = new Date(dateStr);

      return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${d.getFullYear()}`;
    };

    const remainingAmount = booking.total_amount - booking.advance_amount;

    await sendPdfEmail({
      email: booking.guest_email,

      name: booking.guest_name,

      BookingId: booking.id,

      BookingDate: formatDate(booking.created_at),

      CheckinDate: formatDate(booking.check_in),

      CheckoutDate: formatDate(booking.check_out),

      totalPrice: booking.total_amount,

      advancePayable: booking.advance_amount,

      remainingAmount: remainingAmount.toFixed(2),

      mobile: booking.guest_phone,

      totalPerson: booking.adults + booking.children,

      adult: booking.adults,

      child: booking.children,

      vegCount: booking.food_veg,

      nonvegCount: booking.food_nonveg,

      joinCount: booking.food_jain,

      accommodationName: booking.accommodation_name || "",

      accommodationAddress: booking.accommodation_address || "",

      latitude: booking.latitude || "",

      longitude: booking.longitude || "",

      ownerEmail: ownerEmail || "",
      rooms : booking.rooms || "",
      coupon: coupon || "",
      discount : discount || "",
      full_amount : full_amount || ""
    });

    res.json({
      success: true,

      data: {
        booking,

        owner_email: ownerEmail,
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Error creating booking:", error);

    res.status(500).json({
      success: false,

      error: "Failed to create booking",

      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    connection.release();
  }
});

router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID',
      });
    }

    // Check if booking exists
    const [existing] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Delete booking
    await pool.execute('DELETE FROM bookings WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete booking',
      error: error.message,
    });
  }
});

router.post("/payments/payu", async (req, res) => {
  try {
    const { amount, firstname, email, phone, booking_id, productinfo } = req.body;

    // --- Validation ---
    if (!amount || !firstname || !email || !booking_id || !productinfo) {
      return res.status(400).json({ success: false, error: "Missing required payment parameters" });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }
    const formattedAmount = numericAmount.toFixed(2); // PayU requires "100.00"

    const cleanPhone = phone ? phone.toString().replace(/\D/g, "") : "";
    if (cleanPhone.length < 10) {
      return res.status(400).json({ success: false, error: "Valid 10-digit phone required" });
    }

    // --- Check booking ---
    const [booking] = await pool.execute(
      'SELECT id FROM bookings WHERE id = ? AND payment_status = "pending"',
      [booking_id]
    );
    if (booking.length === 0) {
      return res.status(404).json({ success: false, error: "Pending booking not found" });
    }

    // --- Generate txnid ---
    const txnid = `PAYU-${uuidv4()}`;

    // --- UDF fields (all required in live) ---
    const udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "";
    const udf6 = "", udf7 = "", udf8 = "", udf9 = "", udf10 = "";

    // --- Truncate fields ---
    const truncatedProductinfo = productinfo.substring(0, 100);
    const truncatedFirstname = firstname.substring(0, 60);
    const truncatedEmail = email.substring(0, 50);

    // --- Hash string (include all UDFs) ---
    const hashString =
      `${payu_key}|${txnid}|${formattedAmount}|${truncatedProductinfo}|${truncatedFirstname}|${truncatedEmail}|` +
      `${udf1}|${udf2}|${udf3}|${udf4}|${udf5}|${udf6}|${udf7}|${udf8}|${udf9}|${udf10}|${payu_salt}`;

    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    console.log("📑 PayU Hash String:", hashString);
    console.log("🔐 Generated Hash:", hash);

    // --- Save txnid ---
    await pool.execute(
      'UPDATE bookings SET payment_txn_id = ?, payment_status = "pending" WHERE id = ?',
      [txnid, booking_id]
    );

    // --- Payment payload ---
    const paymentData = {
      key: payu_key,
      txnid,
      amount: formattedAmount,
      productinfo: truncatedProductinfo,
      firstname: truncatedFirstname,
      email: truncatedEmail,
      phone: cleanPhone.substring(0, 10),
      surl: `https://api.nirwanastays.com/admin/bookings/success/verify/${txnid}`, // ✅ backend route
      furl: `https://api.nirwanastays.com/admin/bookings/failed/verify/${txnid}`,  // ✅ backend route
      hash,
      currency: "INR",
      udf1, udf2, udf3, udf4, udf5, udf6, udf7, udf8, udf9, udf10
    };

    // --- Respond to frontend ---
    res.json({
      success: true,
      message: "Payment initiated",
      payu_url: `${PAYU_BASE_URL}/_payment`, // test: https://test.payu.in/_payment | live: https://secure.payu.in/_payment
      payment_data: paymentData,
    });

  } catch (error) {
    console.error("💥 PayU initiation error:", error);
    res.status(500).json({ success: false, error: "Payment initiation failed" });
  }
});


// // GET /payment-status/:txnid - Check payment status

// router.get('/payment-status/:txnid', async (req, res) => {

//   try {

//     const { txnid } = req.params;

//     const { force_payu } = req.query;

//     if (!txnid) {

//       return res.status(400).json({

//         success: false,

//         error: 'Transaction ID is required'

//       });

//     }

//     const [bookings] = await pool.execute(

//       'SELECT id, payment_status, payment_txn_id, total_amount, advance_amount, created_at FROM bookings WHERE payment_txn_id = ?',

//       [txnid]

//     );

//     if (bookings.length === 0) {

//       return res.status(404).json({

//         success: false,

//         error: 'Transaction not found'

//       });

//     }

//     const booking = bookings[0];

//     const shouldCheckPayU = force_payu === 'true' ||

//                            booking.payment_status === 'failed' ||

//                            booking.payment_status === 'pending';

//     if (!shouldCheckPayU && booking.payment_status === 'success') {

//       return res.json({

//         success: true,

//         data: {

//           txnid,

//           status: booking.payment_status,

//           source: 'database',

//           booking_id: booking.id,

//           amount: booking.advance_amount || booking.total_amount,

//           message: 'Payment already confirmed as successful'

//         }

//       });

//     }

//     try {

//       const payuClient = new PayU({ key: payu_key, salt: payu_salt });

//       const verifiedData = await payuClient.verifyPayment(txnid);

//       if (!verifiedData || !verifiedData.transaction_details || !verifiedData.transaction_details[txnid]) {

//         return res.json({

//           success: true,

//           data: {

//             txnid,

//             status: booking.payment_status,

//             source: 'database',

//             booking_id: booking.id,

//             amount: booking.advance_amount || booking.total_amount,

//             warning: 'PayU verification returned no data - check merchant dashboard manually',

//             payu_response: verifiedData

//           }

//         });

//       }

//       const transaction = verifiedData.transaction_details[txnid];

//       let finalStatus = 'pending';

//       if (transaction.status === 'success') {

//         finalStatus = 'success';

//       } else if (transaction.status === 'failure' || transaction.status === 'failed') {

//         finalStatus = 'failed';

//       }

//       if (finalStatus !== booking.payment_status) {

//         await pool.execute(

//           'UPDATE bookings SET payment_status = ? WHERE payment_txn_id = ?',

//           [finalStatus, txnid]

//         );

//       }

//       return res.json({

//         success: true,

//         data: {

//           txnid,

//           status: finalStatus,

//           source: 'payu',

//           booking_id: booking.id,

//           amount: transaction.amount || booking.advance_amount || booking.total_amount,

//           payment_id: transaction.mihpayid,

//           payment_mode: transaction.mode,

//           bank_ref_num: transaction.bank_ref_num,

//           payu_status: transaction.status,

//           status_updated: finalStatus !== booking.payment_status,

//           original_db_status: booking.payment_status

//         }

//       });

//     } catch (payuError) {

//       return res.json({

//         success: true,

//         data: {

//           txnid,

//           status: booking.payment_status,

//           source: 'database',

//           booking_id: booking.id,

//           amount: booking.advance_amount || booking.total_amount,

//           error: 'PayU verification failed',

//           error_details: payuError.message,

//           recommendation: 'Check PayU merchant dashboard manually'

//         }

//       });

//     }

//   } catch (error) {

//     console.error('Error checking payment status:', error);

//     res.status(500).json({

//       success: false,

//       error: 'Failed to check payment status',

//       details: process.env.NODE_ENV === 'development' ? error.message : undefined

//     });

//   }

// });

// POST /verify/:txnid - Handle PayU callback (UPDATED)

async function sendPdfEmail(params) {
  const {
    email,

    name,

    BookingId,

    BookingDate,

    CheckinDate,

    CheckoutDate,

    totalPrice,

    advancePayable,

    remainingAmount,

    mobile,

    totalPerson,

    adult,

    child,

    vegCount,

    nonvegCount,

    joinCount,

    accommodationName,

    accommodationAddress,

    latitude,

    longitude,

    ownerEmail,
	  coupon,
	  discount,
	  full_amount,
	  rooms
  } = params;

  console.log("Sending PDF email to:", email);

  if (
    !email ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    console.error("❌ Invalid or missing email, aborting mail send:", email);

    return;
  }

  const html = `<!DOCTYPE html

  PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"

  xmlns:o="urn:schemas-microsoft-com:office:office">



<head>

  <meta http-equiv="Content-type" content="text/html; charset=utf-8" />

  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

  <meta http-equiv="X-UA-Compatible" content="IE=edge" />

  <meta name="format-detection" content="date=no" />

  <meta name="format-detection" content="address=no" />

  <meta name="format-detection" content="telephone=no" />

  <meta name="x-apple-disable-message-reformatting" />

  <link href="https://fonts.googleapis.com/css?family=Lato:400,400i,700,700i" rel="stylesheet" />

  <title>Booking</title>

  <link rel="shortcut icon" href="images/favicon.png">





  <style type="text/css" media="screen">

    body {

      padding: 0 !important;

      margin: 0 !important;

      display: block !important;

      min-width: 100% !important;

      width: 100% !important;

      background: #ffffff;

      -webkit-text-size-adjust: none

    }



    a {

      color: #000001;

      text-decoration: none

    }



    p {

      margin: 0 !important;

    }



    img {

      -ms-interpolation-mode: bicubic;

    }



    .mcnPreviewText {

      display: none !important;

    }



    .cke_editable,

    .cke_editable a,

    .cke_editable span,

    .cke_editable a span {

      color: #000001 !important;

    }



    @media only screen and (max-device-width: 480px),

    only screen and (max-width: 480px) {

      .mobile-shell {

        width: 100% !important;

        min-width: 100% !important;

        padding: 0 3px;

      }



      .bg {

        background-size: 100% auto !important;

        -webkit-background-size: 100% auto !important;

      }



      .text-header,

      .m-center {

        text-align: center !important;

      }



      .center {

        margin: 0 auto !important;

      }



      .container {

        padding: 20px 10px !important

      }



      .td {

        width: 100% !important;

        min-width: 100% !important;

      }



      .m-td,

      .m-hide {

        display: none !important;

        width: 0 !important;

        height: 0 !important;

        font-size: 0 !important;

        line-height: 0 !important;

        min-height: 0 !important;

      }



      .m-block {

        display: block !important;

      }



      .column,

      .column-dir,

      .column-top,

      .column-empty,

      .column-empty2,

      .column-dir-top {

        float: left !important;

        width: 100% !important;

        display: block !important;

      }



      .column-empty {

        padding-bottom: 30px !important;

      }



      .column-empty2 {

        padding-bottom: 10px !important;

      }



      .content-spacing {

        width: 15px !important;

      }



      @media (max-width:600px) {

        .logoimg {

          padding-top: 5px !important;

        }



        .logoimg img {

          width: 130px !important;

          height: 28px !important;

        }



        .mainhead {

          font-size: 12px !important;

        }



        table th,

        table td {

          font-size: 7px !important;

          line-height: 12px !important;

          padding-bottom: 2px !important;

        }



        table.border-table th {

          padding-top: 2px !important;

        }



        .paypd {

          padding: 0px 2px !important;

          font-size: 7px !important;

          margin-bottom: 4px !important;

        }



        .p30-15 {

          padding: 6px 0px 0 !important;

        }



        .socialimgs td,

        .socialimgs td img {

          width: 24px !important;

          height: 24px !important;

          padding: 0 1px;

        }



        .footertd {

          padding: 12px 0 !;

        }



        .bordr {

          border-top-width: 2px !important;

        }



        .mobheadpb {

          padding-bottom: 8px !important;

        }

      }

    }

  </style>

</head>



<body class="body"

  style="padding:0 !important; margin:0 !important; display:block !important; min-width:100% !important; width:100% !important; background:#ffffff; -webkit-text-size-adjust:none;">

  <span class="mcnPreviewText"

    style="display:none; font-size:0px; line-height:0px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; visibility:hidden; mso-hide:all;"></span>



  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f4">

    <tr>

      <td align="center" valign="top">

        <div mc:repeatable="Select" mc:variant="Hero Image">

          <table width="100%" border="0" cellspacing="0" cellpadding="0">

            <tr>

              <td class="m-td" valign="top" style="font-size:0pt; line-height:0pt; text-align:left;">

                <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f4" class="border"

                  style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%;">

                  <tr>

                    <td bgcolor="#f4f4f4" height="auto" class="border"

                      style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%;">&nbsp;</td>

                  </tr>

                </table>

              </td>

              <td valign="center" align="center" class="bordr mobile-shell" width="675" bgcolor="#ffffff"

                style="border-bottom: 3px solid #216896;">

                <table width="675" border="0" cellspacing="0" cellpadding="0" class="mobile-shell">

                  <tr>

                    <td class="td"

                      style="padding-top: 60px; width:675px; min-width:675px; font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal;">

                      <table width="100%" border="0" cellspacing="0" cellpadding="0">

                        <tr>

                          <td class="p30-15" style="padding: 12px;">

                            <table width="100%" border="0" cellspacing="0" cellpadding="0">

                              <tr>

                                <td class="h2 pb25 mainhead"

                                  style="color:#444444; font-family:Lato, Arial ,sans-serif; font-size:22px; font-weight:bold; line-height:24px;padding-bottom:8px;">

                                  <div mc:edit="text_2">${accommodationName} </div>

                                </td>

                              </tr>

                              <tr>

                                <td class="pb25"

                                  style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:15px; padding-bottom:8px;width:100%;padding-right: 6px;">

                                  <div mc:edit="text_3">Booking ID - <b>${BookingId}</b></div>

                                </td>

                              </tr>

                              <tr>

                                <td class="pb25"

                                  style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:14px; line-height:15px; padding-bottom:0;width:100%;padding-right: 5px;">

                                  <div mc:edit="text_3">Booking Date - <span>${BookingDate}</span></div>

                                </td>

                              </tr>

                            </table>

                          </td>

                          <td class="fluid-img logoimg"

                            style="font-size:0pt; line-height:0pt; text-align:right;background:#ffffff;padding-right: 6px;">

                            <img src="https://instagram.fpnq7-8.fna.fbcdn.net/v/t51.2885-19/283634291_534556971515568_864457084658693403_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby43NjguYzIifQ&_nc_ht=instagram.fpnq7-8.fna.fbcdn.net&_nc_cat=100&_nc_oc=Q6cZ2QFu1vjoUJQ4r4JrNEQzOTB3FdYRjq_lyayqvlpNMs6hkEuCI4CgZVgwNHU2CncRvc5K5T9FR1FQxba0o_2fLJvU&_nc_ohc=FgYyB-Jq5r4Q7kNvwHcqfCh&_nc_gid=unsrLNRkWgcF1hzi4QyV6Q&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AfdSgRPdYKpZyIA0n8Co8BpMwTNHMgQgBN5eu5_205ZVeA&oe=68EBBDE7&_nc_sid=7a9f4b" width="auto"

                              height="55" mc:edit="image_2" style="max-height:55px;" border="0" alt="Logo" />

                          </td>

                        </tr>

                      </table>

                    </td>

                  </tr>

                </table>

              </td>

              <td class="m-td" valign="top" style="font-size:0pt; line-height:0pt; text-align:left;">

                <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f4" class="border"

                  style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%;">

                  <tr>

                    <td bgcolor="#f4f4f4" height="auto" class="border"

                      style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%;">&nbsp;</td>

                  </tr>

                </table>

              </td>

            </tr>

          </table>

        </div>





        <div mc:repeatable="Select" mc:variant="Intro">

          <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f4">

            <tr>

              <td class="m-td" valign="top" style="font-size:0pt; line-height:0pt; text-align:left;">

                <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="border"

                  style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%;">

                  <tr>

                    <td bgcolor="#f4f4f4" height="150" class="border"

                      style="font-size:0pt; line-height:0pt; text-align:center; width:100%; min-width:100%;">&nbsp;</td>

                  </tr>

                </table>

              </td>

              <td valign="top" align="center" class="mobile-shell p0-15" width="675" bgcolor="#ffffff">

                <table width="675" border="0" cellspacing="0" cellpadding="0" class="mobile-shell">

                  <tr>

                    <td class="td"

                      style="width:675px; min-width:675px; font-size:0pt; line-height:0pt; padding:0; margin:0; font-weight:normal;">

                      <table width="100%" border="0" cellspacing="0" cellpadding="0">

                        <tr>

                          <td class="bbrr" bgcolor="#ffffff" style="border-radius:0px 0px 12px 12px;">

                            <table width="100%" border="0" cellspacing="0" cellpadding="0">

                              <tr>

                                <td class="p30-15" style="padding: 12px;">



                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:8px;width:50%;">

                                        <div mc:edit="text_3"><b>Dear <span>${name}</span>,</b></div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:8px;width:50%;">

                                        <div mc:edit="text_3"><span>${accommodationName} </span> has

                                          received a request for booking of

                                          your Camping as per the details below. The primary guest <span>${name}</span>

                                          will be

                                          carrying a copy of this e-voucher. </div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:8px;width:50%;">

                                        <div mc:edit="text_3">For your reference, Booking ID is

                                          <span><b>${BookingId}</b></span>.</div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:8px;width:50%;">

                                        <div mc:edit="text_3"><b>The amount payable to <span>${accommodationName} </span> for this booking

                                            is <span>INR ${advancePayable}</span> as per the details below. Please email us at

                                            <a href="mailto: ${ownerEmail}"

                                              style="color: #216896;">bookings@nirwanastays.com</a> if there is any

                                            discrepancy in this payment

                                            amount.</b></div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:8px;width:100%;">

                                        <div mc:edit="text_3">Kindly consider this e-voucher for booking confirmation

                                          with the

                                          following inclusions and services. </div>

                                      </td>

                                    </tr>

                                  </table>



                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:8px;width:100%;">

                                        <div mc:edit="text_3"><b>Team <span>${accommodationName}

                                            </span></b></div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25"

                                        style="color:#878887; font-family:Lato, Arial,sans-serif; font-size:14px; line-height:22px; padding-bottom:8px;width:100%;text-align:right;">

                                        <div mc:edit="text_3">All prices indicated below are in INR</div>

                                      </td>

                                    </tr>

                                  </table>



                                  <table class="border-table" width="100%"

                                    style="font-family: arial, sans-serif;border-collapse: collapse;width: 100%; margin-bottom: 10px;"

                                    cellspacing="0" cellpadding="0">

                                    <tr>

                                      <th class="bordr"

                                        style="border: 1px solid #dddddd;border-top: 3px solid #216896;text-align: left;padding: 9px 7px 10px;color: #878887;font-family: Lato, Arial,sans-serif;font-size: 13.5px;line-height: 16px;">

                                        BOOKING DETAILS</th>

                                      <th class="bordr"

                                        style="border: 1px solid #dddddd;border-top: 3px solid #216896;text-align: left;padding: 9px 7px 10px;color: #878887;font-family: Lato, Arial,sans-serif;font-size: 13.5px;line-height: 16px;">

                                        PAYMENT BREAKUP</th>

                                    </tr>

                                    <tr>

                                      <td valign="top"

                                        style="border: 1px solid #dddddd;text-align: left;padding: 6px 7px 8px;color: #000000;font-family: Lato, Arial,sans-serif;font-size: 13px;line-height: 15px;">

                                        <p style="padding-bottom: 5px;margin: 0px;">Mobile: <b>${mobile}</b></p>

                                        <p style="padding-bottom: 5px;margin: 0px;">Check In: <b>${CheckinDate}</b></p>

                                        <p style="padding-bottom: 5px;margin: 0px;">Check Out: <b>${CheckoutDate}</b></p>

                                        <p style="padding-bottom: 5px;margin: 0px;">Total Person: <b>${totalPerson}</b></p>

                                        <p style="padding-bottom: 5px;margin: 0px;">Adult: <b>${adult}</b></p>

                                        <p style="padding-bottom: 5px;margin: 0px;">Child: <b>${child}</b></p>
					<p style="padding-bottom: 5px;margin: 0px;">Rooms: <b>${rooms}</b></p>


                                        <p style="padding-bottom: 5px;margin: 0px;">Veg Count: <b>${vegCount}</b></p>

                                        <p style="padding-bottom: 5px;margin: 0px;">Non Veg Count: <b>${nonvegCount}</b></p>

                                        <p style="padding-bottom: 5px;margin: 0px;">Jain Count: <b>${joinCount}</b></p>

                                      </td>

                                      <td

                                        style="border: 1px solid #dddddd;text-align: left;padding: 6px 7px 8px;color: #000000;font-family: Lato, Arial,sans-serif;font-size: 14px;line-height: 16px;">

                                        <table style="width: 100%;">

                                          <tr>

                                            <td valign="top" style="width: 100%;padding-right: 8px;">

                                              <p style="padding-top: 5px;padding-bottom: 10px;margin: 0px;">

                                                <b>TARRIF</b></p>
						<p style="padding-bottom: 10px;margin: 0px;">Full Amount: <b style="float:right;">${full_amount}</b></p>
                                              <p style="padding-bottom: 10px;margin: 0px;">Discount: <b style="float:right;">${discount}</b></p>
                                              <p style="padding-bottom: 10px;margin: 0px;">Coupon: <b style="float:right;">${coupon}</b></p>

                                              <p style="padding-bottom: 10px;margin: 0px;">Total Amount: <b

                                                  style="float:right;">${totalPrice}</b></p>

                                              <p style="padding-bottom: 10px;margin: 0px;">Advance Amount: <b

                                                  style="float:right;">${advancePayable}</b></p>

                                              <p style="padding-bottom: 10px;margin: 0px;">Remaining Amount: <b

                                                  style="float:right;">${remainingAmount}</b></p>

                                            </td>

                                          </tr>

                                        </table>

                                      </td>

                                    </tr>

                                  </table>



                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">

                                    <tr>

                                      <td class="pb25 mobheadpb"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:24px;">

                                        <div mc:edit="text_3"><b>Booking Cancellation Policy:</b> From ${CheckinDate},100%

                                          penalty will be

                                          charged. In case of no show : no refund.Booking cannot be

                                          cancelled/modified on or after the booking date and time mentioned in

                                          the Camping Confirmation Voucher. All time mentioned above is in

                                          destination time.</div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25 bordr"

                                        style="color:#216896;border-bottom: 3px solid #216896; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:6px;">

                                        <div mc:edit="text_3"><b>Note</b></div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:8px;padding-top:8px;">

                                        <div mc:edit="text_3">If your contact details have changed, please notify us so

                                          that the

                                          same can be updated in our records.</div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25 mobheadpb"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:24px;">

                                        <div mc:edit="text_3">If the booking is cancelled or changed by guest at a later

                                          stage,

                                          you will be notified and this confirmation email & nirwana stays Booking ID will be null and void.</div>

                                      </td>

                                    </tr>

                                  </table>



                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">

                                    <tr>

                                      <td>

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">

                                          <tr>

                                            <td class="pb25 bordr"

                                              style="color:#216896;border-bottom: 3px solid #216896; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:6px;">

                                              <div mc:edit="text_3"><b>${accommodationName} Contact

                                                  Info</b></div>

                                            </td>

                                          </tr>

                                        </table>

                                      </td>

                                    </tr>

                                  </table>

                                  <table width="100%" border="0" cellspacing="0" cellpadding="0">

                                    <tr>

                                      <td style="padding-top:8px;padding-bottom:8px;width:50%;">

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">

                                          <tr>

                                            <td class="pb25"

                                              style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px;">

                                              <div mc:edit="text_3"><b>${accommodationName} </b></div>

                                            </td>

                                          </tr>

                                          <tr>

                                            <td class="pb25"

                                              style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px;">

                                              <div mc:edit="text_3">At- <span>${accommodationAddress}</span></div>

                                            </td>

                                          </tr>

                                          <tr>

                                            <td class="pb25"

                                              style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px;">

                                              <div mc:edit="text_3"><span>pawna lake</span></div>

                                            </td>

                                          </tr>

                                          <!--<tr>

																										<td class="pb25" style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px;">

																											<div mc:edit="text_3"><span>Maharashtra</span>, <span>India</span></div>

																										</td>

																									</tr>-->

                                          <tr>

                                            <td class="pb25"

                                              style="color:#216896; font-family:Lato, Arial,sans-serif; font-size:14px; line-height:22px;">

                                              <div mc:edit="text_3">

                                                <a href="http://maps.google.com/maps?q=${latitude},${longitude}"

                                                  style="color: #216896;">Google Maps Link</a>

                                              </div>

                                            </td>

                                          </tr>

                                        </table>

                                      </td>

                                      <td style="padding-top:8px;padding-bottom:8px;width:50%;">

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">

                                          <tr>

                                            <td class="pb25"

                                              style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:14px; line-height:22px;">

                                              <div mc:edit="text_3">

                                                <span><b>Email- </b></span><span><a

                                                    href="mailto:${ownerEmail}"

                                                    style="color: #164e6f;"><b>bookings@nirwanastays.com</b></a></span>

                                              </div>

                                            </td>

                                          </tr>

                                          <tr>

                                            <td class="pb25"

                                              style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:14px; line-height:22px;">

                                              <div mc:edit="text_3">

                                                <span><b>Contact Number- </b></span>

                                                <span>Tushar Thakar</span>-<span>9175106307</span>

                                              </div>

                                            </td>

                                          </tr>

                                        </table>

                                      </td>

                                    </tr>

                                  </table>







                                  <table width="100%" border="0" cellspacing="0" cellpadding="0"

                                    style="padding-top: 10px;border-top:1px solid #dddddd;">

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:8px;">

                                        <div mc:edit="text_3"><b>Note</b> - Please do not reply to this email. It has

                                          been sent from an

                                          email account that is not monitored. To ensure that you receive

                                          communication related to your booking from Nirwana stays , please add <a href="mailto:bookings@nirwanastays.com "

                                            style="color: #164e6f;"><b>bookings@nirwanastays.com </b></a> to your contact list

                                          and

                                          address book.</div>

                                      </td>

                                    </tr>

                                  </table>

                                   <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding-top: 15px;">

                                    <tr>

                                      <td class="pb25 bordr"

                                        style="color:#216896;border-bottom: 3px solid #216896; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-bottom:6px;">

                                        <div mc:edit="text_3"><b>Things to Carry</b></div>

                                      </td>

                                    </tr>

                                    <tr>

                                      <td class="pb25"

                                        style="color:#000000; font-family:Lato, Arial,sans-serif; font-size:15px; line-height:22px; padding-top:8px; padding-bottom:8px;">

                                        • Always good to carry extra pair of clothes<br>

                                        • Winter and warm clothes as it will be cold night<br>

                                        • Toothbrush and paste (toiletries)<br>

                                        • Any other things you feel necessary<br>

                                        • Personal medicine if any

                                      </td>

                                    </tr>

                                  </table>

                                </td>

                              </tr>

                            </table>

                          </td>

                        </tr>

                      </table>

                    </td>

                  </tr>

                </table>

              </td>

              <td class="m-td" valign="top" style="font-size:0pt; line-height:0pt; text-align:left;">

                <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="border"

                  style="font-size:0pt; line-height:0pt; text-align:left; width:100%; min-width:100%;">

                  <tr>

                    <td bgcolor="#f4f4f4" height="150" class="border"

                      style="font-size:0pt; line-height:0pt; text-align:left; width:100%; min-width:100%;">&nbsp;</td>

                  </tr>

                </table>

              </td>

            </tr>

          </table>

        </div>



      </td>

    </tr>

  </table>

</body>



</html>`;

  // ... (rest of the HTML template remains the same) ...

  const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",

    secure: false,

    port: 587,

    auth: {
      user: "bookings@nirwanastays.com" ,

      pass: "Nirwanastays@6484",
    },
  });

  const mailOptions = {
    from:"bookings@nirwanastays.com",
    to: email.trim(),
	cc: ownerEmail,
	bcc: "nirwanastays@gmail.com",
    subject: "Resort Camping Booking",

    html: html, // Make sure HTML variable is defined
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent:", info.response);

    return info;
  } catch (err) {
    console.error("❌ Mail send error:", err);

    throw err;
  }
}

router.post("/success/verify/:txnid", async (req, res) => {
  console.log("✅ Payment verification callback received");

  const { txnid } = req.params;
  // const responseData = req.body; // PayU posts txn details here
  // console.log("🔍 PayU Callback Data:", responseData);

  try {
    // --- Rebuild Hash from PayU callback ---
    // const {
    //   status, firstname, email, amount, productinfo,
    //   mihpayid, txnid: payuTxnId,
    //   hash: payuHash,
    //   udf1, udf2, udf3, udf4, udf5, udf6, udf7, udf8, udf9, udf10
    // } = responseData;

    // const hashSequence =
    //   `${payu_salt}|${status}||||||${udf10}|${udf9}|${udf8}|${udf7}|${udf6}|${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${payuTxnId}|${payu_key}`;

    // const calcHash = crypto.createHash("sha512").update(hashSequence).digest("hex");

    // console.log("🔐 PayU Provided Hash:", payuHash);
    // console.log("🔐 Server Calculated Hash:", calcHash);

    // if (calcHash !== payuHash) {
    //   console.error("❌ Hash mismatch – possible tampering!");
    //   return res.redirect(`${FRONTEND_BASE_URL}/payment/failed/${txnid}`);
    // }

    // --- Update DB ---
    const newStatus = "success";
    await pool.execute(
      "UPDATE bookings SET payment_status = ? WHERE payment_txn_id = ?",
      [newStatus, txnid]
    );
    console.log("✅ Booking updated with status:", newStatus);
    const [bookings] = await pool.execute(`
      SELECT guest_email, id, guest_name, guest_phone, rooms, adults, children, 
             food_veg, food_nonveg, food_jain, check_in, check_out, 
             total_amount, advance_amount, accommodation_id 
      FROM bookings WHERE payment_txn_id = ?`,
      [txnid]
    );
    console.log("📦 Bookings fetched:", bookings);

    if (newStatus === "success" && bookings && bookings.length > 0) {
      const bk = bookings[0];
      console.log("🎟️ Booking details:", bk);

      const remainingAmount =
        parseFloat(bk.total_amount) - parseFloat(bk.advance_amount);
      console.log("💰 Remaining amount:", remainingAmount);

      const formatDate = (dateValue) => {
        if (!dateValue) return "Invalid date";
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) throw new Error("Invalid date");
          return format(date, "dd/MM/yyyy");
        } catch (e) {
          console.error("❌ Invalid date format:", dateValue);
          return "Invalid date";
        }
      };

      const today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      const formattedDate = `${year}-${month}-${day}`;
      console.log("📅 Booking date formatted:", formattedDate);

      const recipientEmail = bk.guest_email?.trim();
      console.log("📧 Guest email:", recipientEmail);

      const [accommodations] = await pool.execute(`
        SELECT name, address, latitude, longitude, owner_id 
        FROM accommodations WHERE id = ?`,
        [bk.accommodation_id]
      );
      console.log("🏠 Accommodation fetched:", accommodations);

      const acc = accommodations[0] || {};
      console.log("🏡 Selected accommodation:", acc);

      const owner_id = acc.owner_id;
      console.log("👤 Owner ID:", owner_id);

      const [user] = await pool.execute(
        `SELECT email FROM users WHERE id = ?`,
        [owner_id]
      );
      console.log("👨 Owner fetched:", user);

      const ownerEmail = user[0]?.email;
      console.log("📧 Owner email:", ownerEmail);

      // If you want to enable email sending later, you can log like this:
      
      console.log("🚀 Attempting to send confirmation email...");
      try {
        await sendPdfEmail({
          email: recipientEmail,
          name: bk.guest_name,
          BookingId: bk.id,
          BookingDate: formattedDate,
          CheckinDate: formatDate(bk.check_in),
          CheckoutDate: formatDate(bk.check_out),
          totalPrice: bk.total_amount,
          advancePayable: bk.advance_amount,
          remainingAmount: remainingAmount.toFixed(2),
          mobile: bk.guest_phone,
          totalPerson: bk.adults + bk.children,
          adult: bk.adults,
          child: bk.children,
          vegCount: bk.food_veg,
          nonvegCount: bk.food_nonveg,
          joinCount: bk.food_jain,
          accommodationName: acc.name || "",
          accommodationAddress: acc.address || "",
          latitude: acc.latitude || "",
          longitude: acc.longitude || "",
          ownerEmail: ownerEmail || "",
          rooms: bk.rooms || 0,
        });
        console.log("✅ Confirmation email sent to:", recipientEmail);
      } catch (e) {
        console.error("❌ Email sending failed:", e.message);
      }
    }

    // (Optional) fetch booking + send email logic (your existing code)

    return res.redirect(`${FRONTEND_BASE_URL}/payment/${newStatus}/${txnid}`);

  } catch (error) {
    console.error("💥 Verification error:", error);
    return res.redirect(`${FRONTEND_BASE_URL}/payment/failed/${txnid}`);
  }
});

router.post("/failed/verify/:txnid", async (req, res) => {
  const { txnid } = req.params;
  console.log("❌ Payment failed callback received");
  return res.redirect(`${FRONTEND_BASE_URL}/payment/failed/${txnid}`);
});


router.get("/details/:txnid", async (req, res) => {
  const { txnid } = req.params;

  try {
    // Step 1: Fetch booking by txnid

    const [bookings] = await pool.execute(
      `SELECT guest_email, id, guest_name, guest_phone, rooms, adults, children, food_veg, food_nonveg,

              food_jain, check_in, check_out, total_amount, advance_amount, accommodation_id 

       FROM bookings 

       WHERE payment_txn_id = ?`,

      [txnid]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = bookings[0];

    // Step 2: Fetch accommodation details

    const [accommodations] = await pool.execute(
      `SELECT name, address, latitude, longitude ,owner_id FROM accommodations WHERE id = ?`,

      [booking.accommodation_id]
    );

    const accommodation = accommodations[0] || {};

    const owner_id = accommodation.owner_id;

    const [user] = await pool.execute(`SELECT email FROM users WHERE id = ?`, [
      owner_id,
    ]);

    const ownerEmail = user[0].email;

    const today = new Date();

    const day = String(today.getDate()).padStart(2, "0");

    const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are zero-based

    const year = today.getFullYear();

    const bookedDate = `${year}-${month}-${day}`;

    // Step 3: Combine and return

    return res.json({
      booking,

      accommodation,

      ownerEmail,

      bookedDate,
    });
  } catch (err) {
    console.error("Error fetching booking details:", err);

    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /admin/bookings/:id/status - Manually update payment status

router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;

    const { payment_status } = req.body;

    if (!payment_status) {
      return res
        .status(400)
        .json({ success: false, error: "Payment status is required" });
    }

    const validStatuses = ["pending", "success", "failed", "expired"];

    if (!validStatuses.includes(payment_status)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid payment status" });
    }

    const [result] = await pool.execute(
      "UPDATE bookings SET payment_status = ? WHERE id = ?",
      [payment_status, id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Booking not found" });
    }

    res.json({ success: true, message: "Payment status updated" });
  } catch (error) {
    console.error("Error updating payment status:", error);

    res
      .status(500)
      .json({ success: false, error: "Failed to update payment status" });
  }
});

// GET /admin/bookings/room-occupancy - Get total rooms booked for a specific date

router.get("/room-occupancy", async (req, res) => {
  try {
    const { check_in, id } = req.query;

    // Validate date parameter

    if (!check_in || !/^\d{4}-\d{2}-\d{2}$/.test(check_in)) {
      return res.status(400).json({
        success: false,

        error: "Valid check_in date (YYYY-MM-DD) is required",
      });
    }

    // Calculate total rooms for the date

    const [result] = await pool.execute(
      `SELECT COALESCE(SUM(rooms), 0) AS total_rooms

       FROM bookings

       WHERE payment_status = 'success'

         AND check_in = ?

         AND check_out > ?

         AND accommodation_id=?`,

      [check_in, check_in, id]
    );

    res.json({
      success: true,

      date: check_in,

      total_rooms: result[0].total_rooms,
    });
  } catch (error) {
    console.error("Error fetching room occupancy:", error);

    res.status(500).json({
      success: false,

      error: "Failed to fetch room occupancy data",

      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
