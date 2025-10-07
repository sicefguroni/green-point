import Image from "next/image"
import Link from "next/link"
import {FaGoogle, FaFacebook, FaApple} from "react-icons/fa"
import OutlineButton from "../../components/ui/outlinebutton"
import OutlineInputField from "../../components/ui/outlineinputfield"

export default function Login() {
  return (
    <main>
      <div className="grid grid-cols-1 xl:grid-cols-2 min-h-screen bg-gradient-to-br from-white to-green-100 overflow-x-hidden">
        {/*leftside of grid*/}
        <div className="px-40 md:px-50 xl:px-30 2xl:px-50 py-30 bg-white shadow-xl/10 flex flex-col justify-between relative">
          {/*temprary to be replaced by logo*/}        
          <h1 className="absolute top-20 left-1/2 -translate-x-1/2 text-3xl font-bold text-neutral-black">
						GreenPoint
					</h1>

          <div className="mt-25">
            <div className="flex flex-col justify-center items-left">
              <h1 className="text-4xl text-neutral-black font-semibold">
                Welcome Back!  
              </h1>          
              <h2 className="text-2xl text-neutral-black font-roboto">
                Please enter your details to log in.
              </h2>          
              <div className="flex flex-row justify-between space-x-5 my-5">
                <OutlineButton
                  icon={<FaGoogle size={25} className="text-red-600 "/>}
                />
                <OutlineButton
                  icon={<FaFacebook size={25} className="text-blue-600 "/>}
                />
                <OutlineButton
                  icon={<FaApple size={25} className="text-black "/>}
                />            
              </div>
            </div>   

            <div className="flex items-center">
              <div className="flex-grow h-px bg-gray-300"></div>
              <span className="mx-4 text-gray-400 font-medium">or</span>
              <div className="flex-grow h-px bg-gray-300"></div>
            </div>

            <div className="flex flex-col space-y-5 mt-6 mb-3">
              <OutlineInputField 
                placeholder_="useremail@domain.com"
                label="Email Address"
              />

              <OutlineInputField 
                placeholder_="Enter your password"
                label="Password"
              />

              <Link href="/home_dashboard" className="flex items-center justify-center text-xl text-white bg-primary-green py-4 px-18 rounded-lg font-semibold mt-7 hover:bg-green-700 transition">
                  Log In
              </Link>                
            </div>

            <p className="text-neutral-black/90 text-lg font-roboto font-normal text-center">
              Don't have an account yet? {" "}
              <span className="text-primary-darkgreen underline hover:opacity-65">
                Sign Up
              </span>
            </p>
          </div>


        </div>  

        {/*rightside of grid*/}
        <div className="hidden">
          right
        </div>
      </div>
    </main>
  )
}