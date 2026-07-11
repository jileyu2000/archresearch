param(
    [string]$OutputRoot = (Join-Path $PSScriptRoot "generated")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$datasetPath = Join-Path $PSScriptRoot "dataset.json"
$dataset = Get-Content -Raw -LiteralPath $datasetPath | ConvertFrom-Json
$seedShift = [int]$dataset.seed % 37
$imageRoot = Join-Path $OutputRoot "images"
[System.IO.Directory]::CreateDirectory($imageRoot) | Out-Null

function Get-SvgBody {
    param(
        [string]$AssetType,
        [int]$Variant,
        [string]$Accent
    )

    $level = 70 + ((($Variant + $seedShift) % 3) * 18)
    switch ($AssetType) {
        "plan" {
            return @"
  <g fill="none" stroke="#202522" stroke-width="7">
    <rect x="120" y="110" width="720" height="500"/>
    <path d="M360 110V330H120 M360 330H620V610 M620 110V330 M620 440H840"/>
    <path d="M330 110v34 M360 300h34 M590 330v34 M620 410h34" stroke="#f8faf8" stroke-width="13"/>
    <path d="M330 144a30 30 0 0 1 30-30 M394 300a30 30 0 0 0-30 30" stroke="$Accent" stroke-width="4"/>
  </g>
  <g fill="#303834" font-family="monospace" font-size="20"><text x="130" y="650">LEVEL 0$($Variant % 4)</text><text x="690" y="650">1:200</text></g>
"@
        }
        "section" {
            return @"
  <path d="M80 610H900" stroke="#303834" stroke-width="12"/>
  <g fill="none" stroke="#202522" stroke-width="7">
    <path d="M130 600V170L360 90L650 170H850V600"/>
    <path d="M130 480H850 M210 360H760 M360 170V600 M650 170V600"/>
    <path d="M430 480l110-120h80" stroke="$Accent" stroke-width="8"/>
  </g>
  <g fill="$Accent"><circle cx="470" cy="445" r="9"/><circle cx="560" cy="348" r="9"/></g>
  <g fill="#303834" font-family="monospace" font-size="18"><text x="92" y="478">+$level</text><text x="92" y="358">+${level}0</text></g>
"@
        }
        "elevation" {
            return @"
  <g fill="#eef1ee" stroke="#202522" stroke-width="6">
    <path d="M120 610V190L310 120L520 165L700 115L850 190V610Z"/>
    <g fill="$Accent" fill-opacity="0.16">
      <rect x="170" y="245" width="110" height="90"/><rect x="340" y="245" width="110" height="90"/><rect x="510" y="245" width="110" height="90"/><rect x="680" y="245" width="110" height="90"/>
      <rect x="170" y="405" width="110" height="120"/><rect x="340" y="405" width="110" height="120"/><rect x="510" y="405" width="110" height="120"/><rect x="680" y="405" width="110" height="120"/>
    </g>
    <path d="M310 120V610 M520 165V610 M700 115V610 M120 365H850"/>
  </g>
  <path d="M80 610H900" stroke="#303834" stroke-width="10"/>
"@
        }
        "site_plan" {
            return @"
  <path d="M100 120L820 85L900 560L650 650L120 600Z" fill="#edf1ed" stroke="#59615d" stroke-width="5" stroke-dasharray="14 9"/>
  <g fill="#d9dfda" stroke="#202522" stroke-width="6"><rect x="220" y="210" width="250" height="170" transform="rotate(-4 345 295)"/><rect x="570" y="300" width="190" height="220" transform="rotate(7 665 410)"/></g>
  <path d="M120 510C300 430 410 470 560 570S790 600 880 520" fill="none" stroke="$Accent" stroke-width="18" stroke-opacity="0.55"/>
  <g fill="none" stroke="#7a837e" stroke-width="3"><path d="M120 170C300 120 450 150 850 120"/><path d="M110 200C300 150 480 195 860 150"/><path d="M130 620C330 550 540 650 820 590"/></g>
  <path d="M790 205V105M790 105l-18 34M790 105l18 34" stroke="#202522" stroke-width="6"/><text x="775" y="92" font-family="monospace" font-size="24">N</text>
"@
        }
        "axonometric" {
            return @"
  <g stroke="#202522" stroke-width="6" stroke-linejoin="round">
    <path d="M190 420L460 270L760 420L485 585Z" fill="#e8ece8"/>
    <path d="M190 420V540L485 705V585Z" fill="#d6ddd8"/>
    <path d="M485 585V705L760 540V420Z" fill="#c8d1cb"/>
    <path d="M310 300L470 210L650 310L485 410Z" fill="$Accent" fill-opacity="0.28"/>
    <path d="M310 300V370L485 470V410Z M485 410V470L650 370V310Z" fill="#e2e8e3"/>
    <path d="M410 170L480 130L560 175L485 220Z" fill="$Accent" fill-opacity="0.55"/>
  </g>
  <g stroke="$Accent" stroke-width="3" stroke-dasharray="10 8"><path d="M485 220V410"/><path d="M310 370L190 420"/><path d="M650 370L760 420"/></g>
"@
        }
        "circulation" {
            return @"
  <g fill="none" stroke="#aeb7b1" stroke-width="5"><rect x="130" y="130" width="700" height="470"/><path d="M330 130V600 M590 130V600 M130 350H830"/></g>
  <g fill="none" stroke="$Accent" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
    <path d="M90 520H250V260H480V470H750"/>
    <path d="M730 450l28 20-28 20" fill="$Accent"/>
    <path d="M830 180H650V260" stroke-dasharray="22 14"/>
  </g>
  <g fill="$Accent" stroke="#ffffff" stroke-width="4"><circle cx="90" cy="520" r="18"/><circle cx="830" cy="180" r="18"/><circle cx="480" cy="470" r="13"/></g>
  <g fill="#303834" font-family="monospace" font-size="18"><text x="75" y="558">ENTRY</text><text x="785" y="158">SERVICE</text></g>
"@
        }
        "analysis_diagram" {
            return @"
  <g fill="none" stroke="#303834" stroke-width="5"><path d="M150 560L310 190L520 120L800 270L720 590Z"/></g>
  <path d="M150 560L310 190L470 360L360 590Z" fill="$Accent" fill-opacity="0.42"/>
  <path d="M470 360L520 120L800 270L640 430Z" fill="#2d846b" fill-opacity="0.34"/>
  <path d="M360 590L470 360L640 430L720 590Z" fill="#e6b84a" fill-opacity="0.46"/>
  <g fill="#202522"><circle cx="310" cy="190" r="12"/><circle cx="470" cy="360" r="12"/><circle cx="640" cy="430" r="12"/></g>
  <g font-family="monospace" font-size="18"><rect x="720" y="90" width="24" height="24" fill="$Accent"/><text x="755" y="109">PUBLIC</text><rect x="720" y="125" width="24" height="24" fill="#2d846b"/><text x="755" y="144">CLIMATE</text><rect x="720" y="160" width="24" height="24" fill="#e6b84a"/><text x="755" y="179">SERVICE</text></g>
"@
        }
        "render" {
            return @"
  <rect width="960" height="450" fill="#dfe8e5"/>
  <rect y="450" width="960" height="270" fill="#c9d2cb"/>
  <path d="M160 510L390 250L780 335L590 575Z" fill="#f1f2ef" stroke="#505854" stroke-width="4"/>
  <path d="M390 250L780 335L780 500L590 575L590 415L390 365Z" fill="#bbc6bf" stroke="#505854" stroke-width="4"/>
  <path d="M160 510L390 365L590 415L590 575Z" fill="$Accent" fill-opacity="0.32" stroke="#505854" stroke-width="4"/>
  <g fill="#313936"><rect x="420" y="385" width="65" height="105"/><rect x="505" y="405" width="55" height="100"/></g>
  <path d="M260 575L640 650L850 565L500 520Z" fill="#5b625e" opacity="0.28"/>
  <g fill="#4c5b51"><circle cx="110" cy="430" r="48"/><rect x="104" y="430" width="12" height="110"/><circle cx="855" cy="455" r="56"/><rect x="848" y="455" width="14" height="120"/></g>
"@
        }
        "photograph" {
            $grain = 0..11 | ForEach-Object {
                $x = 70 + (($_ * 73 + $Variant * 19 + $seedShift) % 820)
                $y = 70 + (($_ * 47 + $Variant * 23 + $seedShift) % 560)
                '<circle cx="{0}" cy="{1}" r="{2}" fill="#ffffff" opacity="0.18"/>' -f $x, $y, ((($_ + $Variant) % 5) + 2)
            }
            return @"
  <rect width="960" height="720" fill="#82918a"/>
  <path d="M0 500L270 430L540 500L960 410V720H0Z" fill="#536159"/>
  <path d="M150 500V215L480 145L815 250V545L480 480Z" fill="#c4c9c3"/>
  <path d="M480 145L815 250V545L480 480Z" fill="#929d96"/>
  <g fill="#27312c"><rect x="210" y="285" width="100" height="150"/><rect x="350" y="255" width="90" height="165"/><rect x="545" y="260" width="90" height="155"/><rect x="665" y="300" width="85" height="145"/></g>
  <path d="M120 565L500 505L850 575" fill="none" stroke="$Accent" stroke-width="10" opacity="0.65"/>
  $($grain -join "`n  ")
  <rect x="18" y="18" width="924" height="684" fill="none" stroke="#f4f5f2" stroke-width="8" opacity="0.7"/>
"@
        }
        default { throw "Unknown asset type: $AssetType" }
    }
}

$accents = @("#315cf4", "#e4583e", "#2d846b", "#d49b26")
$records = [System.Collections.Generic.List[string]]::new()
$sampleCount = 0

foreach ($asset in $dataset.asset_types) {
    for ($variant = 1; $variant -le [int]$dataset.variants_per_class; $variant++) {
        $id = "{0}-{1:d2}" -f $asset.id, $variant
        $accent = $accents[($seedShift + $sampleCount) % $accents.Count]
        $body = Get-SvgBody -AssetType $asset.id -Variant $variant -Accent $accent
        $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720" role="img" aria-labelledby="title desc">
  <title id="title">$($asset.title) synthetic evaluation fixture $variant</title>
  <desc id="desc">$($asset.observable_cues -join ", ")</desc>
  <rect width="960" height="720" fill="#f8faf8"/>
$body
</svg>
"@
        $svg = $svg.Replace("`r`n", "`n")
        $imageName = "$id.svg"
        $imagePath = Join-Path $imageRoot $imageName
        [System.IO.File]::WriteAllText($imagePath, $svg, [System.Text.UTF8Encoding]::new($false))
        $sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $imagePath).Hash.ToLowerInvariant()

        $caption = if ($variant % 2 -eq 0) { $asset.explicit_caption } else { $asset.implicit_caption }
        $relevanceCase = ($variant - 1) % 3
        if ($relevanceCase -eq 0) {
            $question = "Find $($asset.title.ToLowerInvariant()) references for the current design problem."
            $expectedRelevance = 4
        }
        elseif ($relevanceCase -eq 1) {
            $question = "Find useful architectural drawing references with clear spatial evidence."
            $expectedRelevance = 3
        }
        else {
            $question = if ($asset.id -eq "photograph") { "Find precise section drawings." } else { "Find completed-project photography." }
            $expectedRelevance = 1
        }

        $record = [ordered]@{
            schema_version = $dataset.schema_version
            dataset_version = $dataset.dataset_version
            id = $id
            asset_type = $asset.id
            image_path = "images/$imageName"
            image_sha256 = $sha256
            caption = $caption
            project_text = "Synthetic fixture $variant for $($asset.title); no project identity or source claim."
            research_question = $question
            expected_relevance = $expectedRelevance
            observable_cues = @($asset.observable_cues)
            synthetic = $true
            rights_status = "user_owned"
        }
        $records.Add(($record | ConvertTo-Json -Compress -Depth 8))
        $sampleCount++
    }
}

$manifestPath = Join-Path $OutputRoot "samples.jsonl"
$manifestText = ($records -join "`n") + "`n"
[System.IO.File]::WriteAllText($manifestPath, $manifestText, [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated $sampleCount deterministic classification samples at $OutputRoot"
