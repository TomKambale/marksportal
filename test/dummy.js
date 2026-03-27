// This simulates the ERP system with various test scenarios
class MockDataService {
    constructor() {
        // Initialize all mock data
        this.lecturers = this.generateLecturers();
        this.semesters = this.generateSemesters();
        this.stages = this.generateStages();
        this.programmes = this.generateProgrammes();
        this.units = this.generateUnits();
        this.students = this.generateStudents();
        this.assignments = this.generateAssignments();
        this.marks = this.generateMarks();
        this.submissionStatus = this.generateSubmissionStatus();
    }

    // LECTURERS 
    generateLecturers() {
        return [
            // Active lecturers
            {
                pfNumber: "TTU0001",
                name: "Dr. John Mwangi",
                email: "john.mwangi@ttu.ac.ke",
                lecturerStatus: "Active",
                department: "Computer Science",
                title: "Senior Lecturer"
            },
            {
                pfNumber: "TTU0002",
                name: "Prof. Sarah Wanjiku",
                email: "sarah.wanjiku@ttu.ac.ke",
                lecturerStatus: "Active",
                department: "Information Technology",
                title: "Professor"
            },
            {
                pfNumber: "TTU0003",
                name: "Dr. Peter Omondi",
                email: "peter.omondi@ttu.ac.ke",
                lecturerStatus: "Active",
                department: "Software Engineering",
                title: "Lecturer"
            },
            {
                pfNumber: "TTU0004",
                name: "Ms. Grace Muthoni",
                email: "grace.muthoni@ttu.ac.ke",
                lecturerStatus: "Active",
                department: "Computer Science",
                title: "Assistant Lecturer"
            },
            {
                pfNumber: "TTU0005",
                name: "Dr. James Kiprop",
                email: "james.kiprop@ttu.ac.ke",
                lecturerStatus: "Active",
                department: "Data Science",
                title: "Senior Lecturer"
            },
            // Inactive lecturer
            {
                pfNumber: "TTU0099",
                name: "Mr. Inactive User",
                email: "inactive.user@ttu.ac.ke",
                lecturerStatus: "Inactive",
                department: "Computer Science",
                title: "Lecturer"
            },
            // Lecturer with no assignments
            {
                pfNumber: "TTU0100",
                name: "Dr. No Assignment",
                email: "no.assignment@ttu.ac.ke",
                lecturerStatus: "Active",
                department: "Mathematics",
                title: "Lecturer"
            }
        ];
    }

    //  SEMESTERS 
    generateSemesters() {
        const currentDate = new Date();
        return [
            {
                semesterId: "SEM-2024-1",
                semesterName: "Semester 1 2024/2025",
                status: "Completed",
                startDate: "2024-01-15",
                endDate: "2024-05-15",
                academicYear: "2024/2025"
            },
            {
                semesterId: "SEM-2024-2",
                semesterName: "Semester 2 2024/2025",
                status: "Completed",
                startDate: "2024-05-20",
                endDate: "2024-09-20",
                academicYear: "2024/2025"
            },
            {
                semesterId: "SEM-2025-1",
                semesterName: "Semester 1 2025/2026",
                status: "Active",
                startDate: "2025-01-15",
                endDate: "2025-05-15",
                academicYear: "2025/2026"
            },
            {
                semesterId: "SEM-2025-2",
                semesterName: "Semester 2 2025/2026",
                status: "Upcoming",
                startDate: "2025-05-20",
                endDate: "2025-09-20",
                academicYear: "2025/2026"
            }
        ];
    }

    //  STAGES 
    generateStages() {
        return [
            // Active stages
            { stageId: "Y1S1", stageCode: "Year 1 Semester 1", status: "Active", year: 1, semester: 1 },
            { stageId: "Y1S2", stageCode: "Year 1 Semester 2", status: "Active", year: 1, semester: 2 },
            { stageId: "Y2S1", stageCode: "Year 2 Semester 1", status: "Active", year: 2, semester: 1 },
            { stageId: "Y2S2", stageCode: "Year 2 Semester 2", status: "Active", year: 2, semester: 2 },
            { stageId: "Y3S1", stageCode: "Year 3 Semester 1", status: "Active", year: 3, semester: 1 },
            { stageId: "Y3S2", stageCode: "Year 3 Semester 2", status: "Active", year: 3, semester: 2 },
            { stageId: "Y4S1", stageCode: "Year 4 Semester 1", status: "Active", year: 4, semester: 1 },
            // Inactive stage
            { stageId: "Y4S2", stageCode: "Year 4 Semester 2", status: "Inactive", year: 4, semester: 2 }
        ];
    }

    //  PROGRAMMES 
    generateProgrammes() {
        return [
            {
                programmeId: "BSC-CS",
                programmeName: "Bachelor of Science in Computer Science",
                status: "Active",
                duration: "4 years",
                school: "School of Computing"
            },
            {
                programmeId: "BSC-IT",
                programmeName: "Bachelor of Science in Information Technology",
                status: "Active",
                duration: "4 years",
                school: "School of Computing"
            },
            {
                programmeId: "BSC-SE",
                programmeName: "Bachelor of Science in Software Engineering",
                status: "Active",
                duration: "4 years",
                school: "School of Computing"
            },
            {
                programmeId: "BSC-DS",
                programmeName: "Bachelor of Science in Data Science",
                status: "Active",
                duration: "4 years",
                school: "School of Computing"
            },
            {
                programmeId: "DIP-CS",
                programmeName: "Diploma in Computer Science",
                status: "Active",
                duration: "2 years",
                school: "School of Computing"
            },
            {
                programmeId: "BSC-MATH",
                programmeName: "Bachelor of Science in Mathematics",
                status: "Inactive",
                duration: "4 years",
                school: "School of Science"
            }
        ];
    }

    //  UNITS 
    generateUnits() {
        return [
            // Computer Science Units
            {
                unitCode: "CSC101",
                unitName: "Introduction to Programming",
                credits: 3,
                catContribution: 30,
                examContribution: 70,
                department: "Computer Science"
            },
            {
                unitCode: "CSC102",
                unitName: "Data Structures and Algorithms",
                credits: 3,
                catContribution: 30,
                examContribution: 70,
                department: "Computer Science"
            },
            {
                unitCode: "CSC201",
                unitName: "Database Systems",
                credits: 3,
                catContribution: 30,
                examContribution: 70,
                department: "Computer Science"
            },
            {
                unitCode: "CSC202",
                unitName: "Operating Systems",
                credits: 3,
                catContribution: 30,
                examContribution: 70,
                department: "Computer Science"
            },
            {
                unitCode: "CSC301",
                unitName: "Artificial Intelligence",
                credits: 3,
                catContribution: 40,
                examContribution: 60,
                department: "Computer Science"
            },
            
            // IT Units
            {
                unitCode: "ITC101",
                unitName: "Introduction to Information Systems",
                credits: 3,
                catContribution: 30,
                examContribution: 70,
                department: "Information Technology"
            },
            {
                unitCode: "ITC201",
                unitName: "Network Security",
                credits: 3,
                catContribution: 30,
                examContribution: 70,
                department: "Information Technology"
            },
            {
                unitCode: "ITC301",
                unitName: "Cloud Computing",
                credits: 3,
                catContribution: 40,
                examContribution: 60,
                department: "Information Technology"
            },
            
            // Software Engineering Units
            {
                unitCode: "SEN101",
                unitName: "Software Engineering Principles",
                credits: 3,
                catContribution: 30,
                examContribution: 70,
                department: "Software Engineering"
            },
            {
                unitCode: "SEN201",
                unitName: "Agile Development",
                credits: 3,
                catContribution: 40,
                examContribution: 60,
                department: "Software Engineering"
            },
            
            // Data Science Units
            {
                unitCode: "DSC101",
                unitName: "Introduction to Data Science",
                credits: 3,
                catContribution: 30,
                examContribution: 70,
                department: "Data Science"
            },
            {
                unitCode: "DSC201",
                unitName: "Machine Learning",
                credits: 3,
                catContribution: 40,
                examContribution: 60,
                department: "Data Science"
            }
        ];
    }

    //  STUDENTS 
    generateStudents() {
        const students = [];
        const programmes = ["BSC-CS", "BSC-IT", "BSC-SE", "BSC-DS"];
        const years = ["2021", "2022", "2023", "2024"];
        
        // Generate 200 students with various registration formats
        for (let i = 1; i <= 200; i++) {
            const year = years[Math.floor(Math.random() * years.length)];
            const programme = programmes[Math.floor(Math.random() * programmes.length)];
            
            // Create various registration number formats for testing edge cases
            let regNo;
            if (i <= 180) {
                // Normal format
                regNo = `TTU/${year}/${i.toString().padStart(5, '0')}`;
            } else if (i <= 190) {
                // Edge case: Invalid format
                regNo = `TTU-${year}-${i}`;
            } else if (i <= 195) {
                // Edge case: Missing prefix
                regNo = `${year}/${i}`;
            } else if (i <= 198) {
                // Edge case: Extra characters
                regNo = `TTU/${year}/${i}/EXTRA`;
            } else {
                // Edge case: Completely invalid
                regNo = `INVALID${i}`;
            }
            
            students.push({
                regNo: regNo,
                name: this.generateStudentName(i),
                programmeId: programme,
                yearOfStudy: parseInt(year),
                email: `student${i}@ttu.ac.ke`,
                phone: `0712${i.toString().padStart(6, '0')}`,
                status: "Active"
            });
        }
        
        return students;
    }

    generateStudentName(index) {
        const firstNames = ["Alice", "Bob", "Carol", "David", "Eve", "Frank", "Grace", "Henry", "Ivy", "Jack",
                           "Kevin", "Linda", "Mary", "Nicholas", "Olivia", "Peter", "Quinn", "Rachel", "Steve", "Tina"];
        const lastNames = ["Wanjiku", "Otieno", "Mwangi", "Kiprop", "Achieng", "Kamau", "Omondi", "Chebet", 
                          "Mutua", "Njeri", "Ochieng", "Wambui", "Korir", "Muthoni", "Kariuki"];
        
        const firstName = firstNames[index % firstNames.length];
        const lastName = lastNames[index % lastNames.length];
        return `${firstName} ${lastName}`;
    }

    //  LECTURER ASSIGNMENTS 
    generateAssignments() {
        const assignments = [];
        const lecturers = ["TTU0001", "TTU0002", "TTU0003", "TTU0004", "TTU0005"];
        const programmes = ["BSC-CS", "BSC-IT", "BSC-SE", "BSC-DS"];
        const stages = ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1"];
        const semesters = ["SEM-2025-1", "SEM-2025-2"];
        
        // Assign units to lecturers
        lecturers.forEach(lecturer => {
            programmes.forEach(programme => {
                stages.forEach(stage => {
                    // Randomly assign 3-5 units per lecturer per stage
                    const numUnits = Math.floor(Math.random() * 3) + 3;
                    const availableUnits = this.units.filter(u => 
                        (programme === "BSC-CS" && u.unitCode.startsWith("CSC")) ||
                        (programme === "BSC-IT" && u.unitCode.startsWith("ITC")) ||
                        (programme === "BSC-SE" && u.unitCode.startsWith("SEN")) ||
                        (programme === "BSC-DS" && u.unitCode.startsWith("DSC"))
                    );
                    
                    for (let i = 0; i < numUnits && i < availableUnits.length; i++) {
                        const unit = availableUnits[i];
                        const studentCount = this.getStudentCountForUnit(unit.unitCode, programme, stage);
                        
                        assignments.push({
                            pfNumber: lecturer,
                            unitCode: unit.unitCode,
                            unitName: unit.unitName,
                            programmeId: programme,
                            programmeName: this.programmes.find(p => p.programmeId === programme).programmeName,
                            stage: stage,
                            studentCount: studentCount,
                            semesterId: semesters[Math.floor(Math.random() * semesters.length)]
                        });
                    }
                });
            });
        });
        
        return assignments;
    }

    getStudentCountForUnit(unitCode, programme, stage) {
        // Generate realistic student counts (30-80 per unit)
        const baseCount = 45;
        const variation = Math.floor(Math.random() * 35);
        return baseCount + variation;
    }

    //  MARKS 
    generateMarks() {
        const marksData = {};
        const allStudents = this.students;
        
        // Generate marks for each assignment
        this.assignments.forEach(assignment => {
            const key = `${assignment.unitCode}_${assignment.semesterId}_${assignment.stage}`;
            const studentsInProgramme = allStudents.filter(s => s.programmeId === assignment.programmeId);
            const unit = this.units.find(u => u.unitCode === assignment.unitCode);
            
            if (!unit) return;
            
            const catMax = unit.catContribution;
            const examMax = unit.examContribution;
            
            marksData[key] = studentsInProgramme.slice(0, assignment.studentCount).map(student => {
                // Generate various mark scenarios for testing edge cases
                const scenario = Math.random();
                
                let catMarks, examMarks, submissionStatus;
                
                if (scenario < 0.7) {
                    // Normal valid marks
                    catMarks = Math.random() * catMax;
                    examMarks = Math.random() * examMax;
                    submissionStatus = "Pending";
                } else if (scenario < 0.8) {
                    // Edge case: Perfect scores
                    catMarks = catMax;
                    examMarks = examMax;
                    submissionStatus = "Submitted";
                } else if (scenario < 0.85) {
                    // Edge case: Zero scores
                    catMarks = 0;
                    examMarks = 0;
                    submissionStatus = "Pending";
                } else if (scenario < 0.9) {
                    // Edge case: Missing CAT marks
                    catMarks = null;
                    examMarks = Math.random() * examMax;
                    submissionStatus = "Pending";
                } else if (scenario < 0.95) {
                    // Edge case: Missing Exam marks
                    catMarks = Math.random() * catMax;
                    examMarks = null;
                    submissionStatus = "Pending";
                } else {
                    // Edge case: Exceeding maximum (invalid)
                    catMarks = catMax + Math.random() * 10;
                    examMarks = examMax + Math.random() * 10;
                    submissionStatus = "Pending";
                }
                
                return {
                    regNo: student.regNo,
                    name: student.name,
                    catMarks: catMarks !== null ? Math.round(catMarks * 10) / 10 : null,
                    examMarks: examMarks !== null ? Math.round(examMarks * 10) / 10 : null,
                    finalMarks: (catMarks && examMarks) ? Math.round((catMarks + examMarks) * 10) / 10 : null,
                    submissionStatus: submissionStatus
                };
            });
        });
        
        return marksData;
    }

    //  SUBMISSION STATUS 
    generateSubmissionStatus() {
        const status = {};
        
        this.assignments.forEach(assignment => {
            const key = `${assignment.unitCode}_${assignment.semesterId}_${assignment.stage}`;
            const isSubmitted = Math.random() > 0.6; // 40% chance of being submitted
            
            status[key] = {
                submitted: isSubmitted,
                submissionDate: isSubmitted ? new Date().toISOString() : null,
                submittedBy: isSubmitted ? assignment.pfNumber : null
            };
        });
        
        return status;
    }

    //  API METHODS 
    
    // Lecturer methods
    getLecturerByEmail(email) {
        const lecturer = this.lecturers.find(l => l.email === email);
        return lecturer || null;
    }
    
    getLecturerByPfNumber(pfNumber) {
        return this.lecturers.find(l => l.pfNumber === pfNumber) || null;
    }
    
    // Academic methods
    getActiveSemesters() {
        return this.semesters.filter(s => s.status === "Active");
    }
    
    getStagesBySemester(semesterId) {
        return this.stages;
    }
    
    getActiveProgrammes() {
        return this.programmes.filter(p => p.status === "Active");
    }
    
    // Assignment methods
    getLecturerAssignments(pfNumber, semesterId, stageId) {
        let assignments = this.assignments.filter(a => a.pfNumber === pfNumber);
        
        if (semesterId) {
            assignments = assignments.filter(a => a.semesterId === semesterId);
        }
        if (stageId) {
            assignments = assignments.filter(a => a.stage === stageId);
        }
        
        return assignments;
    }
    
    // Student methods
    getStudentsForUnit(unitCode, semesterId, stageId, programmeId) {
        const key = `${unitCode}_${semesterId}_${stageId}`;
        const marks = this.marks[key] || [];
        
        // Filter by programme if specified
        let students = marks;
        if (programmeId) {
            students = students.filter(s => {
                const student = this.students.find(st => st.regNo === s.regNo);
                return student && student.programmeId === programmeId;
            });
        }
        
        return students;
    }
    
    validateStudent(regNo, unitCode, semesterId, stageId, programmeId) {
        const student = this.students.find(s => s.regNo === regNo);
        
        if (!student) {
            return {
                matched: false,
                studentName: null,
                errorReason: "Student not found in ERP"
            };
        }
        
        // Check if student is in the correct programme
        if (programmeId && student.programmeId !== programmeId) {
            return {
                matched: false,
                studentName: student.name,
                errorReason: "Student not registered for this programme"
            };
        }
        
        // Check if student is in the correct stage
        const expectedStage = `Y${student.yearOfStudy}S1`;
        if (stageId && stageId !== expectedStage) {
            return {
                matched: false,
                studentName: student.name,
                errorReason: "Student not in the correct stage"
            };
        }
        
        return {
            matched: true,
            studentName: student.name,
            errorReason: null
        };
    }
    
    getUnitContributions(unitCode) {
        const unit = this.units.find(u => u.unitCode === unitCode);
        if (unit) {
            return {
                catContribution: unit.catContribution,
                examContribution: unit.examContribution
            };
        }
        return { catContribution: 30, examContribution: 70 };
    }
    
    submitMarks(payload) {
        const { unitCode, semesterId, stageId, marks } = payload;
        const key = `${unitCode}_${semesterId}_${stageId}`;
        
        // Simulate submission results
        const results = marks.map(mark => {
            // Randomly fail 10% of submissions for testing
            const shouldFail = Math.random() < 0.1;
            
            if (shouldFail) {
                return {
                    regNo: mark.regNo,
                    success: false,
                    errorReason: "Duplicate entry or validation error"
                };
            }
            
            return {
                regNo: mark.regNo,
                success: true,
                errorReason: null
            };
        });
        
        // Update submission status
        this.submissionStatus[key] = {
            submitted: true,
            submissionDate: new Date().toISOString(),
            submittedBy: payload.lecturerPF
        };
        
        return results;
    }
    
    getUnitSubmissionStatus(unitCode, semesterId, stageId) {
        const key = `${unitCode}_${semesterId}_${stageId}`;
        return this.submissionStatus[key] || { submitted: false };
    }
}

module.exports = new MockDataService();