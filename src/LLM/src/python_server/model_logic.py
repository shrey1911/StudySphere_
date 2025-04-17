from pymongo import MongoClient

def recommend_courses(user_query):
    client = MongoClient('mongodb+srv://kuldeep:29114@cluster0.vnqof.mongodb.net/test')  # ya jo bhi tera mongodb URL hai
    db = client['test']  # Yeh tera DB name hai (test)
    courses_collection = db['courses']  # Yeh tera collection hai (courses)

    # Search logic simple hai: tag match karenge
    courses = courses_collection.find({
        "tag": {"$regex": user_query, "$options": "i"}
    })

    recommendations = []
    for course in courses:
        recommendations.append({
            "courseName": course.get("courseName"),
            "courseDescription": course.get("courseDescription"),
            "price": course.get("price"),
            "thumbnail": course.get("thumbnail")
        })

    if not recommendations:
        return [{"message": "Sorry, no information available."}]
    
    return recommendations
