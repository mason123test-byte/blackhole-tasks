function Get-FrozenRoiMetrics([string]$ImagePath) {
  Add-Type -AssemblyName System.Drawing
  $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $ImagePath))
  try {
    if ($bitmap.Width -lt 840 -or $bitmap.Height -lt 510) {
      throw "Frozen ROI requires at least 840x510, got $($bitmap.Width)x$($bitmap.Height)."
    }

    $counts = [int[]]::new(760)
    $corePixels = 0
    for ($x = 80; $x -lt 840; $x++) {
      $columnCount = 0
      for ($y = 330; $y -lt 385; $y++) {
        $p = $bitmap.GetPixel($x, $y)
        if (($p.R + $p.G + $p.B) -gt 540) {
          $columnCount++
          $corePixels++
        }
      }
      $counts[$x - 80] = $columnCount
    }

    $activeCounts = @($counts | Where-Object { $_ -gt 0 })
    $columns = $activeCounts.Count
    $avg = if ($columns -gt 0) { [double]$corePixels / $columns } else { 0.0 }
    $sorted = @($activeCounts | Sort-Object)
    if ($sorted.Count -eq 0) {
      $median = 0.0
    } elseif (($sorted.Count % 2) -eq 1) {
      $median = [double]$sorted[[int][Math]::Floor($sorted.Count / 2)]
    } else {
      $upper = [int]($sorted.Count / 2)
      $median = ([double]$sorted[$upper - 1] + [double]$sorted[$upper]) / 2.0
    }

    $longest = 0
    $run = 0
    foreach ($count in $counts) {
      if ($count -gt 0) {
        $run++
        if ($run -gt $longest) { $longest = $run }
      } else {
        $run = 0
      }
    }

    $rowXs = [System.Collections.Generic.List[int]]::new()
    for ($x = 80; $x -lt 840; $x++) {
      $p = $bitmap.GetPixel($x, 354)
      if (($p.R + $p.G + $p.B) -gt 180) { $rowXs.Add($x - 80) }
    }
    $span = if ($rowXs.Count -gt 0) { $rowXs[$rowXs.Count - 1] - $rowXs[0] + 1 } else { 0 }

    $lower = 0
    for ($y = 360; $y -lt 510; $y++) {
      for ($x = 80; $x -lt 840; $x++) {
        $p = $bitmap.GetPixel($x, $y)
        if (($p.R + $p.G + $p.B) -gt 180) { $lower++ }
      }
    }

    $warm = 0
    for ($y = 180; $y -lt 520; $y++) {
      for ($x = 80; $x -lt 840; $x++) {
        $p = $bitmap.GetPixel($x, $y)
        $wrappedBPlus8 = (($p.B + 8) -band 255)
        if ($p.R -gt $wrappedBPlus8 -and ($p.R + $p.G + $p.B) -gt 180) { $warm++ }
      }
    }

    $shadow = 0
    for ($y = 285; $y -lt 345; $y++) {
      for ($x = 410; $x -lt 510; $x++) {
        $p = $bitmap.GetPixel($x, $y)
        if (($p.R + $p.G + $p.B) -gt 15) { $shadow++ }
      }
    }

    $dead = 0
    for ($y = 0; $y -lt $bitmap.Height; $y++) {
      for ($x = 0; $x -lt $bitmap.Width; $x++) {
        $p = $bitmap.GetPixel($x, $y)
        if ($p.R -eq 255 -and $p.G -eq 255 -and $p.B -eq 255) { $dead++ }
      }
    }

    return [ordered]@{
      avg = $avg
      median = $median
      core = $corePixels
      columns = $columns
      longest = $longest
      span = $span
      lower = $lower
      warm = $warm
      shadow = $shadow
      dead = $dead
    }
  } finally {
    $bitmap.Dispose()
  }
}

