"use client"

import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { getGreeneryClassColor } from "@/lib/chloroplet-colors"
import { FaUsers, FaMoneyBill } from 'react-icons/fa'

export default function ScenarioWeightingSlider() {
  const [value, setValue] = useState([50])
  
  // Convert percentage (0-100) to decimal (0-1) for the color function
  const equityColor = getGreeneryClassColor((100 - value[0]) / 100)
  const costColor = getGreeneryClassColor(value[0] / 100)

  const [textColor, bgColor] = equityColor.split(' ')
  const [textColor2, bgColor2] = costColor.split(' ')

  return (
    <div className="w-full h-full flex flex-col p-6">
      <h1 className="text-neutral-black text-lg font-semibold">Scenario Weighting</h1>
      <div className="flex justify-center gap-2 mt-2 text-sm text-gray-600">
        <p>Equity Priority: <span className={`py-1 px-2 rounded-md ${textColor} ${bgColor}`}>{100 - value[0]}%</span></p>
        <p>Cost Priority: <span className={`py-1 px-2 rounded-md ${textColor2} ${bgColor2}`}>{value[0]}%</span></p>
      </div>
      <div className="relative w-full mt-4">
        <Slider
          min={0}
          max={100}
          step={1}
          value={value}
          onValueChange={setValue}
          className="w-full h-12 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-range]]:bg-[#4CAF50] [&_[data-slot=slider-thumb]]:border-[#4CAF50] [&_[data-slot=slider-thumb]]:bg-gray-100 [&_[data-slot=slider-thumb]]:size-5"
        />
        <div className="flex justify-between text-md font-medium text-neutral-black">
          <p className="flex items-center gap-1"><FaUsers size={16} className="text-primary-green" /> Equity Focus</p>
          <p className="flex items-center gap-1"><FaMoneyBill size={16} className="text-primary-green" /> Cost Focus</p>
        </div>
      </div>
    </div>
  )
}