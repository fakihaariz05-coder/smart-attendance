require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Class = require('../models/Class')

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-attendance')
  console.log('Connected to MongoDB')

  // Clear existing demo data
  await User.deleteMany({ email: { $in: ['admin@demo.com', 'teacher@demo.com', 'student@demo.com'] } })

  // Create demo users
  const [admin, teacher, student] = await User.create([
    { name: 'System Admin', email: 'admin@demo.com', password: 'admin123', role: 'admin', department: 'Administration', isActive: true },
    { name: 'Dr. Sarah Johnson', email: 'teacher@demo.com', password: 'teacher123', role: 'teacher', department: 'Computer Science', isActive: true },
    { name: 'Alex Chen', email: 'student@demo.com', password: 'student123', role: 'student', department: 'Computer Science', studentId: 'CS2024001', isActive: true },
  ])

  // Create demo class
  const demoClass = await Class.create({
    className: 'Introduction to Computer Science',
    classCode: 'CS101',
    description: 'Fundamentals of programming and computational thinking',
    department: 'Computer Science',
    semester: 'Fall 2024',
    teacherId: teacher._id,
    students: [student._id],
    attendanceThreshold: 75,
  })

  console.log('✅ Demo accounts created:')
  console.log('  Admin:   admin@demo.com / admin123')
  console.log('  Teacher: teacher@demo.com / teacher123')
  console.log('  Student: student@demo.com / student123')
  console.log(`✅ Demo class created: ${demoClass.className} (${demoClass.classCode})`)

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
