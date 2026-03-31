/**
 * from: https://metaory.github.io/glitcher-app/
 */
export function Glitch() {
	return <svg xmlns="http://www.w3.org/2000/svg" style="display:none">
		<defs>
			<filter id="glitch" primitiveUnits="objectBoundingBox" x="-10%" y="0%" width="120%" height="100%">
				<feColorMatrix in="SourceGraphic" result="red" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
				<feColorMatrix in="SourceGraphic" result="green" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" />
				<feColorMatrix in="SourceGraphic" result="blue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" />
				<feOffset in="red" result="red-shifted" dx="-0.01" dy="0">
					<animate attributeName="dx" keyTimes="0;0.2574;0.3128;0.4140;0.4861;0.5125;0.8092;1" values="0.0104;0.0052;0.0134;0.0114;0.0119;0.0147;0.0128;0.0099" begin="0" dur="1.5s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.2574;0.3128;0.4140;0.4861;0.5125;0.8092;1" values="0.0104;0.0052;0.0134;0.0114;0.0119;0.0147;0.0128;0.0099" begin="0" dur="1.5s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blue" result="blue-shifted" dx="0.01" dy="0">
					<animate attributeName="dx" keyTimes="0;0.3372;0.4442;0.4945;0.5235;0.7683;0.8834;1" values="0.0088;0.0027;0.0140;0.0152;0.0014;0.0098;0.0039;0.0080" begin="0" dur="1.6500000000000001s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.3372;0.4442;0.4945;0.5235;0.7683;0.8834;1" values="0.0088;0.0027;0.0140;0.0152;0.0014;0.0098;0.0039;0.0080" begin="0" dur="1.6500000000000001s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feBlend mode="screen" in="red-shifted" in2="green" result="red-green" />
				<feBlend mode="screen" in="red-green" in2="blue-shifted" result="blended" />
				<feOffset in="blended" dx="0" dy="0" y="0%" height="8%" result="slice_0">
					<animate attributeName="dx" keyTimes="0;0.0835;0.3037;0.3157;0.5784;0.7885;0.9516;1" values="0.0330;0.0171;0.0203;0.0066;0.0231;0.0394;0.0047;0.0215" begin="0s" dur="226.1941s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.0835;0.3037;0.3157;0.5784;0.7885;0.9516;1" values="0.0330;0.0171;0.0203;0.0066;0.0231;0.0394;0.0047;0.0215" begin="0s" dur="226.1941s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blended" dx="0" dy="0" y="8%" height="19%" result="slice_1">
					<animate attributeName="dx" keyTimes="0;0.0823;0.0873;0.1863;0.2311;0.2943;0.7001;1" values="0.0323;0.0263;0.0297;0.0343;0.0335;0.0153;0.0379;0.0207" begin="0s" dur="215.0984s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.0823;0.0873;0.1863;0.2311;0.2943;0.7001;1" values="0.0323;0.0263;0.0297;0.0343;0.0335;0.0153;0.0379;0.0207" begin="0s" dur="215.0984s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blended" dx="0" dy="0" y="27%" height="12%" result="slice_2">
					<animate attributeName="dx" keyTimes="0;0.2079;0.2442;0.4672;0.5562;0.6286;0.7695;1" values="0.0120;0.0407;0.0065;0.0058;0.0333;0.0117;0.0111;0.0018" begin="0s" dur="232.4371s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.2079;0.2442;0.4672;0.5562;0.6286;0.7695;1" values="0.0120;0.0407;0.0065;0.0058;0.0333;0.0117;0.0111;0.0018" begin="0s" dur="232.4371s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blended" dx="0" dy="0" y="39%" height="22%" result="slice_3">
					<animate attributeName="dx" keyTimes="0;0.4524;0.4849;0.5077;0.5077;0.5558;0.8027;1" values="0.0243;0.0404;0.0172;0.0237;0.0118;0.0124;0.0027;0.0050" begin="0s" dur="219.557s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.4524;0.4849;0.5077;0.5077;0.5558;0.8027;1" values="0.0243;0.0404;0.0172;0.0237;0.0118;0.0124;0.0027;0.0050" begin="0s" dur="219.557s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blended" dx="0" dy="0" y="61%" height="8%" result="slice_4">
					<animate attributeName="dx" keyTimes="0;0.1246;0.1664;0.4319;0.5882;0.7643;0.8532;1" values="0.0351;0.0414;0.0035;0.0307;0.0129;0.0190;0.0123;0.0309" begin="0s" dur="160.6046s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.1246;0.1664;0.4319;0.5882;0.7643;0.8532;1" values="0.0351;0.0414;0.0035;0.0307;0.0129;0.0190;0.0123;0.0309" begin="0s" dur="160.6046s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blended" dx="0" dy="0" y="69%" height="11%" result="slice_5">
					<animate attributeName="dx" keyTimes="0;0.2373;0.2568;0.4583;0.5337;0.5881;0.9587;1" values="0.0364;0.0112;0.0302;0.0240;0.0209;0.0285;0.0414;0.0190" begin="0s" dur="183.2373s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.2373;0.2568;0.4583;0.5337;0.5881;0.9587;1" values="0.0364;0.0112;0.0302;0.0240;0.0209;0.0285;0.0414;0.0190" begin="0s" dur="183.2373s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blended" dx="0" dy="0" y="80%" height="7%" result="slice_6">
					<animate attributeName="dx" keyTimes="0;0.1255;0.2140;0.4281;0.4448;0.8170;0.8923;1" values="0.0402;0.0367;0.0364;0.0178;0.0217;0.0248;0.0027;0.0026" begin="0s" dur="220.9475s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.1255;0.2140;0.4281;0.4448;0.8170;0.8923;1" values="0.0402;0.0367;0.0364;0.0178;0.0217;0.0248;0.0027;0.0026" begin="0s" dur="220.9475s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blended" dx="0" dy="0" y="87%" height="13%" result="slice_7">
					<animate attributeName="dx" keyTimes="0;0.2755;0.4478;0.7002;0.7004;0.8051;0.9748;1" values="0.0069;0.0370;0.0127;0.0154;0.0369;0.0091;0.0368;0.0051" begin="0s" dur="230.3301s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.2755;0.4478;0.7002;0.7004;0.8051;0.9748;1" values="0.0069;0.0370;0.0127;0.0154;0.0369;0.0091;0.0368;0.0051" begin="0s" dur="230.3301s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feMerge>
					<feMergeNode in="slice_0" /><feMergeNode in="slice_1" /><feMergeNode in="slice_2" /><feMergeNode in="slice_3" /><feMergeNode in="slice_4" /><feMergeNode in="slice_5" /><feMergeNode in="slice_6" /><feMergeNode in="slice_7" />
				</feMerge>
			</filter>
		</defs>
	</svg>
}
