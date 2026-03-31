/**
 * from: https://metaory.github.io/glitcher-app/
 */
export function Glitch() {
	const slices = [
		{ y: '0', height: '0.08', keyTimes: '0;0.0835;0.3037;0.3157;0.5784;0.7885;0.9516;1', values: '0.0389;0.0202;0.0240;0.0078;0.0273;0.0465;0.0055;0.0254', dur: '226.1941s' },
		{ y: '0.08', height: '0.19', keyTimes: '0;0.0823;0.0873;0.1863;0.2311;0.2943;0.7001;1', values: '0.0381;0.0310;0.0350;0.0405;0.0395;0.0181;0.0447;0.0244', dur: '215.0984s' },
		{ y: '0.27', height: '0.12', keyTimes: '0;0.2079;0.2442;0.4672;0.5562;0.6286;0.7695;1', values: '0.0142;0.0480;0.0077;0.0068;0.0393;0.0138;0.0131;0.0021', dur: '232.4371s' },
		{ y: '0.39', height: '0.22', keyTimes: '0;0.4524;0.4849;0.5077;0.5077;0.5558;0.8027;1', values: '0.0287;0.0477;0.0203;0.0280;0.0139;0.0146;0.0032;0.0059', dur: '219.557s' },
		{ y: '0.61', height: '0.08', keyTimes: '0;0.1246;0.1664;0.4319;0.5882;0.7643;0.8532;1', values: '0.0414;0.0489;0.0041;0.0362;0.0152;0.0224;0.0145;0.0365', dur: '160.6046s' },
		{ y: '0.69', height: '0.11', keyTimes: '0;0.2373;0.2568;0.4583;0.5337;0.5881;0.9587;1', values: '0.0430;0.0132;0.0356;0.0283;0.0247;0.0336;0.0489;0.0224', dur: '183.2373s' },
		{ y: '0.80', height: '0.07', keyTimes: '0;0.1255;0.2140;0.4281;0.4448;0.8170;0.8923;1', values: '0.0474;0.0433;0.0430;0.0210;0.0256;0.0293;0.0032;0.0031', dur: '220.9475s' },
		{ y: '0.87', height: '0.13', keyTimes: '0;0.2755;0.4478;0.7002;0.7004;0.8051;0.9748;1', values: '0.0081;0.0437;0.0150;0.0182;0.0435;0.0107;0.0434;0.0060', dur: '230.3301s' },
	]

	return <svg xmlns="http://www.w3.org/2000/svg" style="display:none">
		<defs>
			<filter id="glitch" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB" x="-10%" y="0%" width="120%" height="100%">
				<feColorMatrix in="SourceGraphic" result="red" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
				<feColorMatrix in="SourceGraphic" result="green" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" />
				<feColorMatrix in="SourceGraphic" result="blue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" />
				<feOffset in="red" result="red-shifted" dx="-0.0075" dy="0">
					<animate attributeName="dx" keyTimes="0;0.2574;0.3128;0.4140;0.4861;0.5125;0.8092;1" values="0.0078;0.0039;0.0100;0.0086;0.0089;0.0110;0.0096;0.0074" begin="0" dur="1.5s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.2574;0.3128;0.4140;0.4861;0.5125;0.8092;1" values="0.0078;0.0039;0.0100;0.0086;0.0089;0.0110;0.0096;0.0074" begin="0" dur="1.5s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feOffset in="blue" result="blue-shifted" dx="0.0075" dy="0">
					<animate attributeName="dx" keyTimes="0;0.3372;0.4442;0.4945;0.5235;0.7683;0.8834;1" values="0.0066;0.0020;0.0105;0.0114;0.0010;0.0073;0.0029;0.0060" begin="0" dur="1.6500000000000001s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					<animate attributeName="dy" keyTimes="0;0.3372;0.4442;0.4945;0.5235;0.7683;0.8834;1" values="0.0066;0.0020;0.0105;0.0114;0.0010;0.0073;0.0029;0.0060" begin="0" dur="1.6500000000000001s" calcMode="discrete" repeatCount="indefinite" fill="freeze" />
				</feOffset>
				<feBlend mode="screen" in="red-shifted" in2="green" result="red-green" />
				<feBlend mode="screen" in="red-green" in2="blue-shifted" result="blended" />
				{ slices.map((slice, index) => <>
					<feFlood flood-color="white" flood-opacity="1" x="0" y={slice.y} width="1" height={slice.height} result={`slice-mask-${index}`} />
					<feComposite in="blended" in2={`slice-mask-${index}`} operator="in" result={`slice-source-${index}`} />
					<feOffset in={`slice-source-${index}`} dx="0" dy="0" result={`slice_${index}`}>
						<animate attributeName="dx" keyTimes={slice.keyTimes} values={slice.values} begin="0s" dur={slice.dur} calcMode="discrete" repeatCount="indefinite" fill="freeze" />
						<animate attributeName="dy" keyTimes={slice.keyTimes} values={slice.values} begin="0s" dur={slice.dur} calcMode="discrete" repeatCount="indefinite" fill="freeze" />
					</feOffset>
				</>) }
				<feMerge>
					{ slices.map((_, index) => <feMergeNode in={`slice_${index}`} />) }
				</feMerge>
			</filter>
		</defs>
	</svg>
}
