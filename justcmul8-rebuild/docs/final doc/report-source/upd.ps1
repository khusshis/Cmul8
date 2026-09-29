$b = "C:\Users\mohit\AppData\Local\Temp\claude\d--Cmul8\6db26495-78ac-43ab-bcd7-d80fc86976a2\scratchpad\build"
$in = "$b\JustCmul8_Project_Report_Final.docx"
$pdf = "$b\out.pdf"
Remove-Item $pdf -ErrorAction SilentlyContinue
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
$d = $w.Documents.Open($in)
$d.Repaginate()
foreach ($t in $d.TablesOfContents) { $t.Update() }
$d.Fields.Update() | Out-Null
foreach ($t in $d.TablesOfContents) { $t.Update() }
$d.Repaginate()
"Pages: " + $d.ComputeStatistics(2)
$d.SaveAs2("$b\JustCmul8_Project_Report_Final_u.docx", 16)
$d.ExportAsFixedFormat($pdf, 17)
$d.Close(0)
$w.Quit()
