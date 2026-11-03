DELETE FROM Session WHERE scheduleId IS NOT NULL AND status = 'normal'
AND COALESCE(topic,'') = '' AND COALESCE(reason,'') = ''
AND NOT EXISTS (SELECT 1 FROM Note WHERE sessionId=Session.id)
AND NOT EXISTS (SELECT 1 FROM Task WHERE sessionId=Session.id)
AND NOT EXISTS (SELECT 1 FROM Attachment WHERE sessionId=Session.id);
CREATE UNIQUE INDEX "Session_courseId_meetingNo_key" ON Session(courseId,meetingNo);
