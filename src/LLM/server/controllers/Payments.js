const { instance } = require("../config/razorpay")
const Course = require("../models/Course")
const crypto = require("crypto")
const User = require("../models/User")
const mailSender = require("../utils/mailSender")
const mongoose = require("mongoose")
const { uploadImageToCloudinary } = require("../utils/imageUploader")
const {
  courseEnrollmentEmail,
} = require("../mail/templates/courseEnrollmentEmail")
const payment = require("../models/Payment")
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail")
const CourseProgress = require("../models/CourseProgress")
const Blog=require('../models/Blog')

exports.capturePayment = async (req, res) => {
  const { courses,temp } = req.body;
  const userId = req.user.id;
  
  if (courses.length === 0) {
    return res.json({ success: false, message: "Please Provide Course ID" })
  }

  let total_amount = 0;

  for (const course_id of courses) {
    let course
    try {
      // Find the course by its ID
      const course = await Course.findById(course_id)
                    .populate({
                      path: "instructor",
                      populate: { path: "additionalDetails" }
                    });

      if (!course) {
        return res
          .status(200) 
          .json({ success: false, message: "Could not find the Course" })
      }

      // Check if the user is already enrolled in the course
      const uid = new mongoose.Types.ObjectId(userId)
      if (course.studentsEnrolled.includes(uid)) {
        return res
          .status(200)
          .json({ success: false, message: "Student is already Enrolled" })
      }

      // Check if the user is the instructor of the course
      if (course.instructor._id.toString() === userId) {
        return res
          .status(200)
          .json({ success: false, message: "Instructors cannot buy their own courses" })
      }

      total_amount += course.price;

      let instructorId= course?.instructor?.additionalDetails?.contactNumber;

      let pay=await payment.create({
        amount:total_amount,
        course:course_id,
      })

      console.log("Payment Created: ", pay);

    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: error.message })
    }
  }

  if (total_amount-temp === 0) {
    await enrollStudents(courses, userId, res);
    return res.status(200).json({ success: true, message: "Payment Verified" })
  }

  

  const options = {
    amount: (total_amount*100)-(temp*100) ,
    currency: "INR",
    receipt: Date.now().toString(),
  }
  console.log("POTP",options);
  let amount= total_amount;



  
  try {
    const paymentResponse = await instance.orders.create(options);
    res.json({
      success: true,
      data: paymentResponse,
    })
  } catch (error) {
    console.log(error)
    res
      .status(500)
      .json({ success: false, message: "Could not initiate order." })
  }
}

exports.verifyPayment = async (req, res) => {
  try{
    const razorpay_order_id = req.body?.razorpay_order_id || 0;
    const razorpay_payment_id = req.body?.razorpay_payment_id || 0;
    const razorpay_signature = req.body?.razorpay_signature || 0;
    const courses = req.body?.courses;
  
    const userId = req.user.id
  
    // if (
    //   !razorpay_order_id ||
    //   !razorpay_payment_id ||
    //   !razorpay_signature ||
    //   !courses ||
    //   !userId
    // ) {
    //   return res.status(200).json({ success: false, message: "Payment Failed" })
    // }
  
    let body = razorpay_order_id + "|" + razorpay_payment_id
  
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body.toString())
      .digest("hex")
  
    await enrollStudents(courses, userId);
  
    //if (expectedSignature === razorpay_signature) {
      return res.status(200).json({ success: true, message: "Payment Verified" })
    //}
  }catch(error){
    return res.status(200).json({ success: false, message: "Payment Failed" })
  }

}

// Send Payment Success Email
exports.sendPaymentSuccessEmail = async (req, res) => {
  const { orderId, paymentId, amount } = req.body

  const userId = req.user.id

  if (!orderId || !paymentId || !amount || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide all the details" })
  }

  try {
    const enrolledStudent = await User.findById(userId)
    await mailSender(
      enrolledStudent.email,
      `Payment Received`,
      paymentSuccessEmail(
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100,
        orderId,
        paymentId
      )
    )
  } catch (error) {
    console.log("error in sending mail", error)
    return res
      .status(400)
      .json({ success: false, message: "Could not send email" })
  }
}

// enroll the student in the courses
const enrollStudents = async (courses, userId) => {
  if (!courses || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please Provide Course ID and User ID" })
  }

  for (const courseId of courses) {
    try {
      // Find the course and enroll the student in it
      const enrolledCourse = await Course.findOneAndUpdate(
        { _id: courseId },
        { $push: { studentsEnrolled: userId } },
        { 
          new: true,
          populate: {
            path: "instructor",
            select: "_id firstName lastName email image"
          }
        }
      )

      if (!enrolledCourse) {
        return res
          .status(500)
          .json({ success: false, error: "Course not found" })
      }

      const courseProgress = await CourseProgress.create({
        courseID: courseId,
        userId: userId,
        completedVideos: [],
      })
      
      const enrolledStudent = await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            courses: courseId,
            courseProgress: courseProgress._id,
          },
        },
        { new: true }
      )

      console.log("Enrolled student: ", enrolledStudent)
      // Send an email notification to the enrolled student
      const emailResponse = await mailSender(
        enrolledStudent.email,
        `Successfully Enrolled into ${enrolledCourse.courseName}`,
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          `${enrolledStudent.firstName} ${enrolledStudent.lastName}`
        )
      )

      console.log("Email sent successfully: ", emailResponse.response)
    } catch (error) {
      console.log(error)
      return res.status(400).json({ success: false, error: error.message })
    }
  }
}

exports.getPayments = async (req,res) => {
  try {
    const pay= await payment.find({});
    console.log("Payment Details: ", pay);
    return res.status(200).json({
      success:true,
      data:pay,
    })
      
    }catch (error) {
      console.log(error)
      return res.status(400).json({ success: false, error: error.message })
    }
}

exports.deletePayments = async (req,res) => {
  try {
    const {id}= req.body;
    const pay= await payment.findByIdAndDelete(id);
    return res.status(200).json({
      success:true,
      data:pay,
    })
      
    }catch (error) {
      console.log(error)
      return res.status(400).json({ success: false, error: error.message })
    }
}

exports.createBlog = async (req,res) => {
  try {
    const {blogName,blogDescription,creator}= req.body;
    const thumbnail = req.files.thumbnail;

    console.log(req.files);
    
    const thumbnailImage = await uploadImageToCloudinary(
          thumbnail,
          "Blog"
    )
    console.log(thumbnailImage);

    const blogData= await Blog.create({
      blogName,
      blogDescription,
      creator,
      thumbnail:thumbnailImage.secure_url,
    });

    return res.status(200).json({
      success:true,
      data:blogData,
    })
      
    }catch (error) {
      console.log(error)
      return res.status(400).json({ success: false, error: error.message })
    }
}

exports.getBlogs = async (req,res) => {
  try {
    const blogs= await Blog.find({}).populate("creator");
    return res.status(200).json({
      success:true,
      data:blogs,
    })
      
    }catch (error) {
      console.log(error)
      return res.status(400).json({ success: false, error: error.message })
    }
}