Set oShell = CreateObject("WScript.Shell")
appPath = "C:\Users\jesse\OneDrive\Desktop\productivity-tracker"
oShell.Run "cmd /c cd /d """ & appPath & """ && set DATABASE_URL=file:" & appPath & "\prisma\dev.db && npx next start -H 0.0.0.0 -p 3000", 0, False
