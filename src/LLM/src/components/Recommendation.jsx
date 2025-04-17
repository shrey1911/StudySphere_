import React, { useEffect, useState } from "react";
import { getCourses } from "../api";

const Recommendations = () => {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await getCourses();
      console.log(response.data); // 🔥 Check here
      setCourses(response.data); // Just set full data
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-900 text-white">
      <h2 className="text-3xl font-bold mb-6 text-center">📚 Recommended Courses</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {courses.slice(0, 3).map((course) => (
  <div
    key={course._id}
    className="bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl p-5 transition-transform transform hover:-translate-y-1"
  >
    <img
      src={course.thumbnail}
      alt={course.courseName}
      className="rounded-lg mb-4 w-full h-40 object-cover"
    />
    <h3 className="text-xl font-semibold mb-2">
      {course.courseName || "Untitled Course"}
    </h3>
    <p className="text-gray-400 mb-2">
      {course.courseDescription || "No description available."}
    </p>
    <p className="text-sm text-gray-500">
      Price: {course.price ? `₹${course.price}` : "Free"}
    </p>
  </div>
))}

      </div>
    </div>
  );
};

export default Recommendations;
