@echo off
cd /d "C:\Web Personal\finanzas-ia"
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set dt=%%a
set fecha=%dt:~0,8%_%dt:~8,4%
set dest=C:\Users\lucas\iCloudDrive\Documents\FinanzasIA\Backups\backup_finanzas-ia_%fecha%.zip
git archive --format=zip --output "%dest%" HEAD
echo Backup creado en iCloud: %dest%
pause
