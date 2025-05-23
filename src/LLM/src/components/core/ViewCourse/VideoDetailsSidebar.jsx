import { useEffect, useState } from "react"
import { BsChevronDown } from "react-icons/bs"
import { IoIosArrowBack } from "react-icons/io"
import { useSelector } from "react-redux"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { HiDocumentText } from "react-icons/hi"
import { BsQuestionCircle } from "react-icons/bs"
import MaterialViewModal from "./MaterialViewModal"
import QuizView from "./QuizView"
import IconBtn from "../../common/IconBtn"

export default function VideoDetailsSidebar({ setReviewModal }) {
  const [activeStatus, setActiveStatus] = useState("")
  const [videoBarActive, setVideoBarActive] = useState("")
  const [viewMaterial, setViewMaterial] = useState(null)
  const [viewQuiz, setViewQuiz] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { sectionId, subSectionId } = useParams()
  const {
    courseSectionData,
    courseEntireData,
    totalNoOfLectures,
    completedLectures,
  } = useSelector((state) => state.viewCourse)

  useEffect(() => {
    const setActiveFlags = () => {
      if (!courseSectionData?.length) return
      const currentSectionIndex = courseSectionData.findIndex(
        (data) => data._id === sectionId
      )
      const currentSubSectionIndex = courseSectionData?.[currentSectionIndex]?.subSection?.findIndex(
        (data) => data._id === subSectionId
      )
      const activeSubSectionId =
        courseSectionData[currentSectionIndex]?.subSection?.[currentSubSectionIndex]?._id
      setActiveStatus(courseSectionData?.[currentSectionIndex]?._id)
      setVideoBarActive(activeSubSectionId)
    }
    setActiveFlags()
  }, [courseSectionData, courseEntireData, location.pathname, sectionId, subSectionId])

  if (!courseSectionData?.length) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] w-[320px] max-w-[350px] flex-col items-center justify-center border-r-[1px] border-r-richblack-700 bg-richblack-800">
        <p className="text-lg text-richblack-50">Loading...</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-[calc(100vh-3.5rem)] w-[320px] max-w-[350px] flex-col border-r-[1px] border-r-richblack-700 bg-richblack-800">
        <div className="mx-5 flex flex-col items-start justify-between gap-2 gap-y-4 border-b border-richblack-600 py-5 text-lg font-bold text-richblack-25">
          <div className="flex w-full items-center justify-between ">
            <div
              onClick={() => {
                navigate(`/dashboard/enrolled-courses`)
              }}
              className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-richblack-100 p-1 text-richblack-700 hover:scale-90"
              title="back"
            >
              <IoIosArrowBack size={30} />
            </div>
            <IconBtn
              text="Add Review"
              customClasses="ml-auto"
              onclick={() => setReviewModal(true)}
            />
          </div>
          <div className="flex flex-col">
            <p>{courseEntireData?.courseName}</p>
            <p className="text-sm font-semibold text-richblack-500">
              {completedLectures?.length} / {totalNoOfLectures}
            </p>
          </div>
        </div>

        <div className="h-[calc(100vh - 5rem)] overflow-y-auto">
          {courseSectionData.map((course, index) => (
            <div
              className="mt-2 cursor-pointer text-sm text-richblack-5"
              onClick={() => setActiveStatus(course?._id)}
              key={index}
            >
              {/* Section */}
              <div className="flex flex-row justify-between bg-richblack-600 px-5 py-4">
                <div className="w-[70%] font-semibold">
                  {course?.sectionName}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`${
                      activeStatus === course?._id
                        ? "rotate-0"
                        : "rotate-180"
                    } transition-all duration-500`}
                  >
                    <BsChevronDown />
                  </span>
                </div>
              </div>

              {/* Sub Sections and Materials */}
              {activeStatus === course?._id && (
                <div className="transition-[height] duration-500 ease-in-out">
                  {/* Sub Sections */}
                  {course?.subSection?.map((topic, i) => (
                    <div
                      className={`flex gap-3 px-5 py-2 ${
                        videoBarActive === topic._id
                          ? "bg-yellow-200 font-semibold text-richblack-800"
                          : "hover:bg-richblack-900"
                      }`}
                      key={i}
                      onClick={() => {
                        navigate(
                          `/view-course/${courseEntireData?._id}/section/${course?._id}/sub-section/${topic?._id}`
                        )
                        setVideoBarActive(topic._id)
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={completedLectures?.includes(topic?._id)}
                        onChange={() => {}}
                      />
                      {topic.title}
                    </div>
                  ))}

                  {/* Materials */}
                  {course?.materials?.map((material, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-x-3 px-5 py-2 hover:bg-richblack-900 cursor-pointer"
                      onClick={() => setViewMaterial(material)}
                    >
                      <HiDocumentText className="text-xl text-yellow-50" />
                      <p className="flex-1 text-sm text-richblack-50 hover:text-yellow-50">
                        {material.title}
                      </p>
                    </div>
                  ))}

                  {/* Quizzes */}
                  {course?.quizzes?.map((quiz, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-x-3 px-5 py-2 hover:bg-richblack-900 cursor-pointer"
                      onClick={() => {
                        console.log("Quiz data:", quiz)
                        setViewQuiz(quiz)
                      }}
                    >
                      <BsQuestionCircle className="text-xl text-yellow-50" />
                      <p className="flex-1 text-sm text-richblack-50 hover:text-yellow-50">
                        {quiz.title}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Material View Modal */}
      {viewMaterial && (
        <MaterialViewModal
          material={viewMaterial}
          setViewMaterial={setViewMaterial}
        />
      )}

      {/* Quiz View Modal */}
      {viewQuiz && (
        <div className="fixed inset-0 z-[1000] !mt-0 grid h-screen w-screen place-items-center overflow-auto bg-black/20 backdrop-blur-lg">
          <div className="my-10 w-11/12 max-w-[900px]">
            <QuizView quiz={viewQuiz} onClose={() => setViewQuiz(null)} />
          </div>
        </div>
      )}
    </>
  )
}